import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Wrench, Circle } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { EventDurationsSection } from "@/components/admin/EventDurationsSection";

const ADMIN_EMAIL = "samiaavikko@gmail.com";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "Admin-valikko" }] }),
  component: Gate,
});

function Gate() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  if (!user) return <Navigate to="/login" />;
  if ((user.email ?? "").toLowerCase() !== ADMIN_EMAIL) return <Navigate to="/" />;
  return <Page />;
}

interface EventRow {
  id: string;
  event_name: string;
  path: string;
  user_id: string | null;
  user_email: string | null;
  role: string | null;
  metadata: Record<string, unknown> | null;
  user_agent: string | null;
  created_at: string;
}

function Page() {
  const q = useQuery({
    queryKey: ["admin", "analytics-events"],
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from("analytics_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10000);
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  const usersQ = useQuery({
    queryKey: ["admin", "auth-users-activity"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_auth_users_with_activity");
      if (error) throw error;
      return (data ?? []) as {
        user_id: string;
        email: string;
        last_sign_in_at: string | null;
        last_seen_at: string | null;
      }[];
    },
  });

  const [userFilter, setUserFilter] = useState("");
  const filteredUsers = useMemo(() => {
    const list = usersQ.data ?? [];
    const f = userFilter.trim().toLowerCase();
    if (!f) return list;
    return list.filter((u) => (u.email ?? "").toLowerCase().includes(f));
  }, [usersQ.data, userFilter]);

  const downloadUsersCsv = () => {
    const list = usersQ.data ?? [];
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = ["email,last_seen_at,last_sign_in_at"];
    for (const u of list) {
      lines.push([
        escape(u.email ?? ""),
        escape(u.last_seen_at ?? ""),
        escape(u.last_sign_in_at ?? ""),
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const rows = q.data ?? [];


  const stats = useMemo(() => {
    const byEvent = new Map<string, number>();
    const byPath = new Map<string, number>();
    const byDay = new Map<string, number>();
    const byDayUniqueSets = new Map<string, Set<string>>();
    const byDayLoggedInSets = new Map<string, Set<string>>();
    const byRole = new Map<string, number>();
    const byAthlete = new Map<string, { count: number; name: string | null }>();
    const byCompetition = new Map<string, { count: number; name: string | null }>();
    const uniqueUsers = new Set<string>();
    const allUniqueVisitors = new Set<string>();
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayUsers = new Set<string>();
    let todayEvents = 0;
    const last7dStart = new Date(Date.now() - 7 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const last7dUsers = new Set<string>();
    let last7dEvents = 0;
    const last24h = Date.now() - 24 * 3600 * 1000;
    let last24hCount = 0;
    for (const r of rows) {
      byEvent.set(r.event_name, (byEvent.get(r.event_name) ?? 0) + 1);
      byPath.set(r.path, (byPath.get(r.path) ?? 0) + 1);
      const day = r.created_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
      byRole.set(r.role ?? "anon", (byRole.get(r.role ?? "anon") ?? 0) + 1);
      const visitorId = r.user_id ?? r.user_email ?? r.user_agent ?? null;
      if (visitorId) {
        let set = byDayUniqueSets.get(day);
        if (!set) {
          set = new Set<string>();
          byDayUniqueSets.set(day, set);
        }
        set.add(visitorId);
        allUniqueVisitors.add(visitorId);
        if (day === todayStr) todayUsers.add(visitorId);
        if (day >= last7dStart) last7dUsers.add(visitorId);
      }
      if (r.user_id) {
        uniqueUsers.add(r.user_id);
        let set = byDayLoggedInSets.get(day);
        if (!set) {
          set = new Set<string>();
          byDayLoggedInSets.set(day, set);
        }
        set.add(r.user_id);
      }
      if (day === todayStr) todayEvents++;
      if (day >= last7dStart) last7dEvents++;
      if (new Date(r.created_at).getTime() >= last24h) last24hCount++;

      const md = (r.metadata ?? {}) as Record<string, unknown>;
      if (r.event_name === "athlete_view") {
        const key = typeof md.athlete_key === "string" ? md.athlete_key : null;
        if (key) {
          const prev = byAthlete.get(key);
          const name = typeof md.athlete_name === "string" ? md.athlete_name : null;
          byAthlete.set(key, {
            count: (prev?.count ?? 0) + 1,
            name: prev?.name ?? name,
          });
        }
      }
      if (r.event_name === "scoreboard_view" || r.event_name === "round_view") {
        const cid = md.competition_id;
        const key = cid != null ? String(cid) : null;
        if (key) {
          const prev = byCompetition.get(key);
          const name =
            typeof md.competition_name === "string" ? md.competition_name : null;
          byCompetition.set(key, {
            count: (prev?.count ?? 0) + 1,
            name: prev?.name ?? name,
          });
        }
      }
    }
    const sortDesc = (m: Map<string, number>) =>
      Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    const sortDescObj = <T extends { count: number }>(m: Map<string, T>) =>
      Array.from(m.entries()).sort((a, b) => b[1].count - a[1].count);
    const allDays = new Set<string>([
      ...byDay.keys(),
      ...byDayUniqueSets.keys(),
      ...byDayLoggedInSets.keys(),
    ]);
    const byDayCombined = Array.from(allDays)
      .map((day) => ({
        day,
        uniqueVisitors: byDayUniqueSets.get(day)?.size ?? 0,
        uniqueLoggedIn: byDayLoggedInSets.get(day)?.size ?? 0,
        events: byDay.get(day) ?? 0,
      }))
      .sort((a, b) => (a.day < b.day ? 1 : -1));
    return {
      total: rows.length,
      last24h: last24hCount,
      uniqueUsers: uniqueUsers.size,
      allUniqueVisitors: allUniqueVisitors.size,
      todayUsers: todayUsers.size,
      todayEvents,
      last7dUsers: last7dUsers.size,
      last7dEvents,
      byEvent: sortDesc(byEvent),
      byPath: sortDesc(byPath),
      byRole: sortDesc(byRole),
      byAthlete: sortDescObj(byAthlete),
      byCompetition: sortDescObj(byCompetition),
      byDayCombined,
    };
  }, [rows]);

  const downloadCsv = () => {
    const headers = [
      "created_at",
      "event_name",
      "path",
      "role",
      "user_email",
      "user_id",
      "user_agent",
      "metadata",
    ];
    const escape = (v: unknown) => {
      const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.created_at,
          r.event_name,
          r.path,
          r.role ?? "",
          r.user_email ?? "",
          r.user_id ?? "",
          r.user_agent ?? "",
          r.metadata ?? "",
        ]
          .map(escape)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [tab, setTab] = useState<"analytics" | "durations">("analytics");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Wrench className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Admin-valikko</h1>
            <Link
              to="/planner"
              className="ml-2 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-secondary"
            >
              Aikataulun suunnittelija →
            </Link>
          </div>
          <div className="flex shrink-0 gap-0.5 rounded-full border border-border bg-card p-0.5 text-[11px] font-medium">
            {(["analytics", "durations"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1 transition-colors ${
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {t === "analytics" ? "Käyttöanalytiikka" : "Lajien kestot"}
              </button>
            ))}
          </div>
          {tab === "analytics" && (
            <Button onClick={downloadCsv} disabled={rows.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Lataa CSV
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {tab === "durations" ? (
          <EventDurationsSection />
        ) : (
        <>
        {q.isLoading && <p className="text-sm text-muted-foreground">Ladataan…</p>}
        {q.error && (
          <p className="text-sm text-destructive">
            Virhe: {(q.error as Error).message}
          </p>
        )}

        <section className="space-y-3">
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Tänään
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
              <StatCard
                label="Uniikit kävijät"
                value={stats.todayUsers}
                hint="kirjautuneet + anonyymit selaimet"
              />
              <StatCard label="Tapahtumia" value={stats.todayEvents} />
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Viim. 7 päivää
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
              <StatCard label="Uniikit kävijät" value={stats.last7dUsers} />
              <StatCard label="Tapahtumia" value={stats.last7dEvents} />
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Kaikkiaan
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Uniikit kävijät"
                value={stats.allUniqueVisitors}
                hint="kirjautuneet + anonyymit selaimet"
              />
              <StatCard
                label="Kirjautuneet käyttäjät"
                value={stats.uniqueUsers}
                hint="uniikit tilit"
              />
              <StatCard label="Tapahtumia" value={stats.total} />
              <StatCard label="Viim. 24h" value={stats.last24h} />
            </div>
          </div>
        </section>

        <Section title="Päivittäin – kävijät ja tapahtumat">
          <DailyTable data={stats.byDayCombined} />
        </Section>

        <Section title="Näkymät / tapahtumat">
          <Table data={stats.byEvent} keyLabel="Tapahtuma" />
        </Section>

        <Section title="Sivut / polut">
          <Table data={stats.byPath} keyLabel="Polku" />
        </Section>

        <Section title="Käyttäjäroolit">
          <Table data={stats.byRole} keyLabel="Rooli" />
        </Section>

        <Section title="Katsotuimmat urheilijat">
          <NamedTable
            data={stats.byAthlete}
            keyLabel="Urheilija"
            linkPrefix="/athlete/"
          />
        </Section>

        <Section title="Katsotuimmat kilpailut">
          <NamedTable data={stats.byCompetition} keyLabel="Kilpailu" />
        </Section>


        <Section title={`Kaikki käyttäjät (${usersQ.data?.length ?? 0})`}>
          {usersQ.isLoading && (
            <p className="text-xs text-muted-foreground">Ladataan…</p>
          )}
          {usersQ.error && (
            <p className="text-xs text-destructive">
              Virhe: {(usersQ.error as Error).message}
            </p>
          )}
          {usersQ.data && (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  placeholder="Hae sähköpostilla…"
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="h-8 flex-1 min-w-[200px] rounded-md border border-border bg-background px-2 text-xs"
                />
                <Button size="sm" variant="outline" onClick={downloadUsersCsv}>
                  <Download className="mr-2 h-3 w-3" />
                  CSV
                </Button>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-2">Sähköposti</th>
                      <th className="p-2">Viimeksi nähty</th>
                      <th className="p-2">Viimeisin kirjautuminen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.user_id} className="border-t">
                        <td className="p-2">{u.email}</td>
                        <td className="p-2 whitespace-nowrap text-muted-foreground">
                          {u.last_seen_at
                            ? new Date(u.last_seen_at).toLocaleString("fi-FI")
                            : "—"}
                        </td>
                        <td className="p-2 whitespace-nowrap text-muted-foreground">
                          {u.last_sign_in_at
                            ? new Date(u.last_sign_in_at).toLocaleString("fi-FI")
                            : "ei koskaan"}
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-2 text-center text-muted-foreground">
                          Ei käyttäjiä.
                        </td>
                      </tr>
                    )}

                  </tbody>
                </table>
              </div>
            </>
          )}
        </Section>

        <Section title="Viimeisimmät tapahtumat (50)">

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">Aika</th>
                  <th className="p-2">Tapahtuma</th>
                  <th className="p-2">Polku</th>
                  <th className="p-2">Rooli</th>
                  <th className="p-2">Käyttäjä</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("fi-FI")}
                    </td>
                    <td className="p-2">{r.event_name}</td>
                    <td className="p-2 font-mono">{r.path}</td>
                    <td className="p-2">{r.role}</td>
                    <td className="p-2">{r.user_email ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        </>
        )}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value.toLocaleString("fi-FI")}</div>
      {hint && <div className="mt-1 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function DailyTable({
  data,
}: {
  data: { day: string; uniqueVisitors: number; uniqueLoggedIn: number; events: number }[];
}) {
  if (data.length === 0)
    return <p className="text-xs text-muted-foreground">Ei dataa.</p>;
  const max = Math.max(...data.map((d) => d.uniqueVisitors), 1);
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="p-2">Päivä</th>
            <th className="p-2 text-right">Uniikit kävijät</th>
            <th className="p-2 text-right">Kirjautuneet</th>
            <th className="p-2 text-right">Tapahtumia</th>
            <th className="p-2 w-1/3">Osuus</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day} className="border-t">
              <td className="p-2 font-mono">{d.day}</td>
              <td className="p-2 text-right tabular-nums">
                {d.uniqueVisitors.toLocaleString("fi-FI")}
              </td>
              <td className="p-2 text-right tabular-nums">
                {d.uniqueLoggedIn.toLocaleString("fi-FI")}
              </td>
              <td className="p-2 text-right tabular-nums">
                {d.events.toLocaleString("fi-FI")}
              </td>
              <td className="p-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${(d.uniqueVisitors / max) * 100}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function NamedTable({
  data,
  keyLabel,
  linkPrefix,
}: {
  data: [string, { count: number; name: string | null }][];
  keyLabel: string;
  linkPrefix?: string;
}) {
  if (data.length === 0)
    return <p className="text-xs text-muted-foreground">Ei dataa.</p>;
  const max = data[0][1].count;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="p-2">{keyLabel}</th>
            <th className="p-2">Tunniste</th>
            <th className="p-2 text-right">Määrä</th>
            <th className="p-2 w-1/3">Osuus</th>
          </tr>
        </thead>
        <tbody>
          {data.map(([k, v]) => (
            <tr key={k} className="border-t">
              <td className="p-2">
                {linkPrefix ? (
                  <Link
                    to="/athlete/$key"
                    params={{ key: k }}
                    className="text-primary hover:underline"
                  >
                    {v.name || "(nimetön)"}
                  </Link>
                ) : (
                  v.name || "(nimetön)"
                )}
              </td>
              <td className="p-2 font-mono text-muted-foreground">{k}</td>
              <td className="p-2 text-right tabular-nums">
                {v.count.toLocaleString("fi-FI")}
              </td>
              <td className="p-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${(v.count / max) * 100}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Table({ data, keyLabel }: { data: [string, number][]; keyLabel: string }) {
  if (data.length === 0)
    return <p className="text-xs text-muted-foreground">Ei dataa.</p>;
  const max = data[0][1];
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="p-2">{keyLabel}</th>
            <th className="p-2 text-right">Määrä</th>
            <th className="p-2 w-1/3">Osuus</th>
          </tr>
        </thead>
        <tbody>
          {data.map(([k, v]) => (
            <tr key={k} className="border-t">
              <td className="p-2 font-mono">{k || "(tyhjä)"}</td>
              <td className="p-2 text-right tabular-nums">{v.toLocaleString("fi-FI")}</td>
              <td className="p-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${(v / max) * 100}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
