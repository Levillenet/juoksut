import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, BarChart3 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const ADMIN_EMAIL = "samiaavikko@gmail.com";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "Analytiikka – Admin" }] }),
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

  const rows = q.data ?? [];

  const stats = useMemo(() => {
    const byEvent = new Map<string, number>();
    const byPath = new Map<string, number>();
    const byDay = new Map<string, number>();
    const byRole = new Map<string, number>();
    const byAthlete = new Map<string, { count: number; name: string | null }>();
    const byCompetition = new Map<string, { count: number; name: string | null }>();
    const uniqueUsers = new Set<string>();
    const last24h = Date.now() - 24 * 3600 * 1000;
    let last24hCount = 0;
    for (const r of rows) {
      byEvent.set(r.event_name, (byEvent.get(r.event_name) ?? 0) + 1);
      byPath.set(r.path, (byPath.get(r.path) ?? 0) + 1);
      const day = r.created_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
      byRole.set(r.role ?? "anon", (byRole.get(r.role ?? "anon") ?? 0) + 1);
      if (r.user_id) uniqueUsers.add(r.user_id);
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
    return {
      total: rows.length,
      last24h: last24hCount,
      uniqueUsers: uniqueUsers.size,
      byEvent: sortDesc(byEvent),
      byPath: sortDesc(byPath),
      byDay: Array.from(byDay.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1)),
      byRole: sortDesc(byRole),
      byAthlete: sortDescObj(byAthlete),
      byCompetition: sortDescObj(byCompetition),
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Käyttöanalytiikka</h1>
          </div>
          <Button onClick={downloadCsv} disabled={rows.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Lataa CSV
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {q.isLoading && <p className="text-sm text-muted-foreground">Ladataan…</p>}
        {q.error && (
          <p className="text-sm text-destructive">
            Virhe: {(q.error as Error).message}
          </p>
        )}

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Tapahtumia yhteensä" value={stats.total} />
          <StatCard label="Viim. 24h" value={stats.last24h} />
          <StatCard label="Uniikkeja käyttäjiä" value={stats.uniqueUsers} />
          <StatCard label="Päiviä" value={stats.byDay.length} />
        </section>

        <Section title="Näkymät / tapahtumat">
          <Table data={stats.byEvent} keyLabel="Tapahtuma" />
        </Section>

        <Section title="Sivut / polut">
          <Table data={stats.byPath} keyLabel="Polku" />
        </Section>

        <Section title="Käyttäjäroolit">
          <Table data={stats.byRole} keyLabel="Rooli" />
        </Section>

        <Section title="Päivittäin">
          <Table data={stats.byDay} keyLabel="Päivä" />
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
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value.toLocaleString("fi-FI")}</div>
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
