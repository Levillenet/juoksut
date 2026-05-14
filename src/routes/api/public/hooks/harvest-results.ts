// Nightly harvester: scans recent tuloslista competition IDs for results from
// any athlete that anyone in the app has put on watch, and persists them to
// athlete_results. Idempotent thanks to the unique index on
// (athlete_key, competition_id, event_id).
//
// Triggered by pg_cron once a day. Can also be invoked manually with
// ?fromId=...&toId=... to backfill a wider range.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const API = "https://cached-public-api.tuloslista.com/live/v1";

interface Allocation {
  Surname?: string;
  Firstname?: string;
  Organization?: { Id?: number; Name?: string } | null;
  Result?: string | null;
  ResultRank?: number | null;
  Wind?: number | null;
}

interface PropertiesShape {
  Competition?: {
    Id: number;
    Name?: string;
    BeginDate?: string;
    Organization?: string;
  };
}

interface EventShape {
  Id: number;
  Name: string;
  EventCategory?: string;
  EventSubCategory?: string;
  BeginDateTimeWithTZ?: string;
  Rounds: { Heats: { Allocations: Allocation[] }[] }[];
}

interface RoundsByDateShape {
  [date: string]: { EventId: number }[];
}

interface Target {
  surname: string;
  firstname: string;
  organizationId: number | null;
  athlete_key: string;
}

function parseResultNumeric(text: string, category: string): number | null {
  if (!text) return null;
  const t = text.trim();
  if (!t || /^(DNF|DNS|DQ|NM|FAIL)$/i.test(t)) return null;
  const cleaned = t.replace(",", ".").replace(/[a-zA-Z]/g, "").trim();
  if (!cleaned) return null;
  if (category === "Track") {
    const parts = cleaned.split(":").map((p) => parseFloat(p));
    if (parts.some((n) => Number.isNaN(n))) return null;
    let s = 0;
    for (const p of parts) s = s * 60 + p;
    return s;
  }
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

function matchTarget(a: Allocation, byName: Map<string, Target[]>): Target | null {
  if (!a.Surname || !a.Firstname) return null;
  const key = `${a.Surname}|${a.Firstname}`;
  const candidates = byName.get(key);
  if (!candidates) return null;
  for (const t of candidates) {
    if (t.organizationId == null) return t;
    if (a.Organization?.Id === t.organizationId) return t;
  }
  return null;
}

async function harvest(fromId: number, toId: number, concurrency = 6) {
  // 1. Load distinct watched athletes
  const { data: watched, error: werr } = await supabaseAdmin
    .from("watched_athletes")
    .select("athlete_key, surname, firstname, organization_id");
  if (werr) throw werr;
  if (!watched || watched.length === 0) {
    return { scanned: 0, found: 0, targets: 0, fromId, toId };
  }
  const seen = new Set<string>();
  const targets: Target[] = [];
  for (const w of watched) {
    if (seen.has(w.athlete_key)) continue;
    seen.add(w.athlete_key);
    targets.push({
      surname: w.surname,
      firstname: w.firstname,
      organizationId: w.organization_id,
      athlete_key: w.athlete_key,
    });
  }
  const byName = new Map<string, Target[]>();
  for (const t of targets) {
    const k = `${t.surname}|${t.firstname}`;
    const arr = byName.get(k) ?? [];
    arr.push(t);
    byName.set(k, arr);
  }

  // 2. Crawl competition IDs
  const ids: number[] = [];
  for (let i = toId; i >= fromId; i--) ids.push(i);
  let cursor = 0;
  let scanned = 0;
  let found = 0;
  const pending: Record<string, unknown>[] = [];

  const flush = async () => {
    if (pending.length === 0) return;
    const batch = pending.splice(0, pending.length);
    await supabaseAdmin
      .from("athlete_results")
      .upsert(batch, {
        onConflict: "athlete_key,competition_id,event_id",
        ignoreDuplicates: true,
      });
  };

  const worker = async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      const props = await fetchJson<PropertiesShape>(
        `${API}/competition/${id}/properties`,
      );
      if (!props?.Competition?.Id) {
        scanned++;
        continue;
      }
      const byDate = await fetchJson<RoundsByDateShape>(`${API}/competition/${id}`);
      if (byDate) {
        const eventIds = Array.from(
          new Set(Object.values(byDate).flat().map((r) => r.EventId)),
        );
        for (const eid of eventIds) {
          const ev = await fetchJson<EventShape>(`${API}/results/${id}/${eid}`);
          if (!ev) continue;
          const category = ev.EventCategory ?? "";
          const subCategory = ev.EventSubCategory ?? "";
          for (const r of ev.Rounds ?? []) {
            for (const h of r.Heats ?? []) {
              for (const a of h.Allocations ?? []) {
                const t = matchTarget(a, byName);
                if (!t || !a.Result) continue;
                pending.push({
                  athlete_key: t.athlete_key,
                  surname: t.surname,
                  firstname: t.firstname,
                  organization: a.Organization?.Name ?? "",
                  organization_id: a.Organization?.Id ?? t.organizationId ?? null,
                  competition_id: id,
                  competition_name: props.Competition?.Name ?? "",
                  competition_date:
                    props.Competition?.BeginDate ?? ev.BeginDateTimeWithTZ ?? null,
                  location: "",
                  event_id: ev.Id,
                  event_name: ev.Name,
                  sub_category: subCategory,
                  event_category: category,
                  result_text: a.Result,
                  result_numeric: parseResultNumeric(a.Result, category),
                  result_rank: a.ResultRank ?? null,
                  wind: a.Wind ?? null,
                });
                found++;
              }
            }
          }
        }
      }
      scanned++;
      if (pending.length >= 50) await flush();
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  await flush();
  return { scanned, found, targets: targets.length, fromId, toId };
}

export const Route = createFileRoute("/api/public/hooks/harvest-results")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        return run(request);
      },
      GET: async ({ request }) => {
        return run(request);
      },
    },
  },
});

async function run(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let fromId = Number(url.searchParams.get("fromId"));
  let toId = Number(url.searchParams.get("toId"));

  // Default: sliding window around the most recent known competition_id
  if (!fromId || !toId) {
    const { data } = await supabaseAdmin
      .from("athlete_results")
      .select("competition_id")
      .order("competition_id", { ascending: false })
      .limit(1);
    const latest = data?.[0]?.competition_id ?? 18800;
    // Re-scan last 50 IDs (results may update) and 250 forward (new comps)
    fromId = latest - 50;
    toId = latest + 250;
  }
  // Clamp to a sane absolute window
  fromId = Math.max(15000, fromId);
  toId = Math.min(25000, Math.max(fromId, toId));

  try {
    const result = await harvest(fromId, toId);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    console.error("harvest-results failed:", e);
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
