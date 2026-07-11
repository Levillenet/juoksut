import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, AlertTriangle, CheckCircle2, RefreshCw, Power } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  probeTuloslista,
  getMonitorSnapshot,
  runMonitorNow,
  setHarvesterBlocked,
  getOriginCallStats,
  type ProbeResult,
} from "@/lib/tuloslista-probe.functions";
import { formatRelativeFi } from "@/lib/harvest-status";

const ADMIN_EMAIL = "samiaavikko@gmail.com";

export const Route = createFileRoute("/admin/tuloslista-probe")({
  head: () => ({ meta: [{ title: "Admin · Tuloslista-testi" }] }),
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

function EndpointCard({
  title,
  subtitle,
  status,
  now,
}: {
  title: string;
  subtitle: string;
  status: {
    ok: boolean;
    status: number;
    durationMs: number;
    bodyBytes: number;
    contentType: string | null;
    reason: string | null;
    checkedAt: string | null;
  } | null;
  now: Date;
}) {
  const ok = status?.ok === true;
  return (
    <div
      className={`rounded-lg border p-3 ${
        !status
          ? "border-border bg-card"
          : ok
            ? "border-green-600/40 bg-green-600/5"
            : "border-destructive/40 bg-destructive/5"
      }`}
    >
      <div className="flex items-start gap-2">
        {status ? (
          ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[11px] text-muted-foreground">{subtitle}</div>
          {status ? (
            <div className="mt-1 space-y-0.5 text-xs">
              <div>
                <span className="text-muted-foreground">HTTP:</span> {status.status} ·{" "}
                <span className="text-muted-foreground">Kesto:</span> {status.durationMs} ms ·{" "}
                <span className="text-muted-foreground">Tavut:</span> {status.bodyBytes}
              </div>
              {status.reason && (
                <div className="text-destructive">Syy: {status.reason}</div>
              )}
              {status.checkedAt && (
                <div className="text-muted-foreground">
                  Tarkistettu {formatRelativeFi(new Date(status.checkedAt), now)}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">Ei tietoja vielä</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded border bg-background p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

const PRESETS = [
  { id: "harvester", label: "juoksut-harvester/1.0" },
  { id: "proxy", label: "juoksut-proxy/1.0" },
  { id: "browser", label: "Chrome (selain)" },
];

const EXAMPLES = [
  "/live/v1/competition",
  "/live/v1/competition/12345",
  "/live/v1/competition/12345/properties",
  "/live/v1/results/12345/67890",
];

function Page() {
  const [path, setPath] = useState("/live/v1/competition");
  const [uaPreset, setUaPreset] = useState("harvester");
  const [customUa, setCustomUa] = useState("");
  const [result, setResult] = useState<ProbeResult | null>(null);

  const probeFn = useServerFn(probeTuloslista);
  const runM = useMutation({
    mutationFn: async () =>
      probeFn({ data: { path, uaPreset, customUa: customUa || undefined } }),
    onSuccess: (r) => setResult(r),
  });

  const snapshotFn = useServerFn(getMonitorSnapshot);
  const monitorRunFn = useServerFn(runMonitorNow);
  const setBlockedFn = useServerFn(setHarvesterBlocked);
  const originStatsFn = useServerFn(getOriginCallStats);

  const snapshotQ = useQuery({
    queryKey: ["tuloslista-monitor-snapshot"],
    queryFn: () => snapshotFn(),
    refetchInterval: 30_000,
  });

  const statsQ = useQuery({
    queryKey: ["tuloslista-origin-call-stats"],
    queryFn: () => originStatsFn(),
    refetchInterval: 60_000,
  });

  const runMonitorM = useMutation({
    mutationFn: async () => monitorRunFn(),
    onSuccess: () => snapshotQ.refetch(),
  });

  const toggleBlockedM = useMutation({
    mutationFn: async (blocked: boolean) =>
      setBlockedFn({ data: { blocked, reason: blocked ? "manuaalisesti asetettu" : undefined } }),
    onSuccess: () => snapshotQ.refetch(),
  });

  const snap = snapshotQ.data;
  const now = new Date();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            to="/admin/analytics"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-base font-semibold">Tuloslista-rajapinnan testi</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <section
          className={`rounded-lg border p-4 ${
            snap?.blocked
              ? "border-destructive/40 bg-destructive/10"
              : "border-green-600/40 bg-green-600/10"
          }`}
        >
          <div className="flex items-start gap-3">
            {snap?.blocked ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-sm font-semibold">
                {snap
                  ? snap.blocked
                    ? "Harvesteri pysäytetty: tulos-rajapinta ei vastaa"
                    : "Harvesteri käynnissä"
                  : "Ladataan valvonnan tilaa…"}
              </div>
              {snap?.blocked && snap.blockReason && (
                <div className="text-sm text-destructive">Syy: {snap.blockReason}</div>
              )}
              <div className="text-xs text-muted-foreground">
                {snap?.blockCheckedAt
                  ? `Tarkistettu ${formatRelativeFi(new Date(snap.blockCheckedAt), now)}`
                  : "Ei tarkistuksia vielä"}
                {snap?.blocked && snap.blockSince && (
                  <> · esto alkoi {formatRelativeFi(new Date(snap.blockSince), now)}</>
                )}
                {snap?.lastHarvestRunAt && (
                  <> · harvesteri viimeksi {formatRelativeFi(new Date(snap.lastHarvestRunAt), now)}</>
                )}
                {snap && snap.consecutiveResultFailures > 0 && (
                  <> · peräkkäisiä tulos-epäonnistumisia: {snap.consecutiveResultFailures}</>
                )}
              </div>
              {snap?.lastApiMessage && (
                <div className="mt-2 rounded border border-amber-400/60 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  <div className="font-semibold">
                    Tuloslista-viesti
                    {snap.lastApiMessageAt
                      ? ` · ${formatRelativeFi(new Date(snap.lastApiMessageAt), now)}`
                      : ""}
                    {snap.lastApiMessageSource
                      ? ` · lähde: ${snap.lastApiMessageSource}`
                      : ""}
                    {snap.lastApiMessageEndpoint
                      ? ` · ${snap.lastApiMessageEndpoint}`
                      : ""}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap break-words">
                    {snap.lastApiMessage}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => runMonitorM.mutate()}
              disabled={runMonitorM.isPending}
            >
              <RefreshCw
                className={`mr-1 h-3 w-3 ${runMonitorM.isPending ? "animate-spin" : ""}`}
              />
              Tarkista nyt
            </Button>
            {snap?.blocked ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleBlockedM.mutate(false)}
                disabled={toggleBlockedM.isPending}
              >
                <Power className="mr-1 h-3 w-3" /> Pura esto käsin
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleBlockedM.mutate(true)}
                disabled={toggleBlockedM.isPending}
              >
                <Power className="mr-1 h-3 w-3" /> Pysäytä harvesteri
              </Button>
            )}
          </div>
        </section>

        {snap && (
          <section className="grid gap-3 sm:grid-cols-2">
            <EndpointCard
              title="Kilpailulista"
              subtitle="/live/v1/competition (välimuistin kautta)"
              status={snap.list}
              now={now}
            />
            <EndpointCard
              title="Kilpailun tulokset"
              subtitle="/live/v1/competition/{id}/properties (auto-eston signaali)"
              status={snap.results}
              now={now}
            />
          </section>
        )}

        <p className="text-xs text-muted-foreground">
          Harvesterin auto-esto reagoi vain tulos-endpointtiin. Lista-endpoint
          voi palauttaa 200 OK välimuistista silloinkin, kun tulokset eivät ole
          saatavilla.
        </p>

        {statsQ.data && statsQ.data.length > 0 && (
          <section className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Kutsutilastot (30 pv)</h2>
              <div className="text-xs text-muted-foreground">
                Origin = tuloslista.com · Reuna = oma välimuisti
              </div>
            </div>
            {(() => {
              const total = statsQ.data.reduce(
                (a, d) => {
                  a.origin += d.originCalls;
                  a.edge += d.servedFromEdge;
                  a.err += d.errors;
                  return a;
                },
                { origin: 0, edge: 0, err: 0 },
              );
              const served = total.origin + total.edge;
              const savedPct = served > 0 ? Math.round((total.edge / served) * 100) : 0;
              return (
                <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <Stat label="Origin-kutsut" value={total.origin.toLocaleString("fi-FI")} />
                  <Stat
                    label="Reunavälimuistista"
                    value={total.edge.toLocaleString("fi-FI")}
                    hint={`${savedPct}% säästö`}
                  />
                  <Stat
                    label="Virheet (4xx/5xx)"
                    value={total.err.toLocaleString("fi-FI")}
                  />
                  <Stat label="Päiviä" value={String(statsQ.data.length)} />
                </div>
              );
            })()}
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-2">Päivä</th>
                    <th className="py-1 pr-2">Origin</th>
                    <th className="py-1 pr-2">Reuna</th>
                    <th className="py-1 pr-2">Säästö</th>
                    <th className="py-1 pr-2">Virheet</th>
                    <th className="py-1">Lähteet</th>
                  </tr>
                </thead>
                <tbody>
                  {statsQ.data.map((d) => {
                    const served = d.originCalls + d.servedFromEdge;
                    const pct = served > 0 ? Math.round((d.servedFromEdge / served) * 100) : 0;
                    const sources = Object.entries(d.bySource)
                      .filter(([s]) => s !== "proxy_cache")
                      .sort((a, b) => b[1] - a[1])
                      .map(([s, n]) => `${s}:${n}`)
                      .join(" · ");
                    return (
                      <tr key={d.day} className="border-t">
                        <td className="py-1 pr-2 whitespace-nowrap font-mono">{d.day}</td>
                        <td className="py-1 pr-2">{d.originCalls.toLocaleString("fi-FI")}</td>
                        <td className="py-1 pr-2">{d.servedFromEdge.toLocaleString("fi-FI")}</td>
                        <td className="py-1 pr-2">{pct}%</td>
                        <td className={`py-1 pr-2 ${d.errors > 0 ? "text-destructive" : ""}`}>
                          {d.errors}
                        </td>
                        <td className="py-1 text-muted-foreground">{sources || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Origin-kutsut = harvester, hot-cycle, monitor ja proxy-välimuistin
              ohitukset (miss). Reuna = kutsut, jotka palveltiin omalta Cloudflare-reunalta
              ilman origin-kutsua.
            </p>
          </section>
        )}

        {snap && snap.recent.length > 0 && (
          <details className="rounded-lg border bg-card p-3 text-sm" open>
            <summary className="cursor-pointer font-semibold">
              Valvontakyselyt (viimeiset {snap.recent.length})
            </summary>
            <div className="mt-2 max-h-72 overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-2">Aika</th>
                    <th className="py-1 pr-2">Endpoint</th>
                    <th className="py-1 pr-2">Tila</th>
                    <th className="py-1 pr-2">HTTP</th>
                    <th className="py-1 pr-2">Kesto</th>
                    <th className="py-1 pr-2">Tavut</th>
                    <th className="py-1">Huomio</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.recent.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-1 pr-2 whitespace-nowrap">
                        {formatRelativeFi(new Date(r.checkedAt), now)}
                      </td>
                      <td className="py-1 pr-2">
                        {r.endpoint === "results" ? "tulokset" : "lista"}
                      </td>
                      <td className="py-1 pr-2">
                        {r.ok ? (
                          <span className="text-green-600">OK</span>
                        ) : (
                          <span className="text-destructive">esto</span>
                        )}
                      </td>
                      <td className="py-1 pr-2">{r.status}</td>
                      <td className="py-1 pr-2">{r.durationMs} ms</td>
                      <td className="py-1 pr-2">{r.bodyBytes}</td>
                      <td className="py-1 text-muted-foreground">{r.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}


        <p className="text-sm text-muted-foreground">
          Manuaalinen testi: yksi suora kutsu osoitteeseen{" "}
          <code className="rounded bg-muted px-1">cached-public-api.tuloslista.com</code>,
          ohittaa oman reunavälimuistin. Voit valita myös selain-User-Agentin.
        </p>

        <div className="space-y-2">
          <Label htmlFor="tp-path">Polku</Label>
          <Input
            id="tp-path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/live/v1/competition"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setPath(ex)}
                className="rounded border px-2 py-0.5 text-xs hover:bg-secondary"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>User-Agent</Label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setUaPreset(p.id)}
                className={`rounded border px-3 py-1 text-xs ${
                  uaPreset === p.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Input
            value={customUa}
            onChange={(e) => setCustomUa(e.target.value)}
            placeholder="Vapaaehtoinen: oma User-Agent (ohittaa presetin)"
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={() => runM.mutate()} disabled={runM.isPending}>
            {runM.isPending ? "Kysytään…" : "Tee kysely"}
          </Button>
        </div>

        {runM.error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {runM.error instanceof Error ? runM.error.message : "Virhe"}
          </div>
        )}

        {result && (
          <div className="space-y-3 rounded-lg border bg-card p-4 text-sm">
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                <span
                  className={
                    result.status >= 200 && result.status < 300
                      ? "font-semibold text-green-600"
                      : "font-semibold text-destructive"
                  }
                >
                  {result.status} {result.statusText}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Kesto:</span> {result.durationMs} ms
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">URL:</span>{" "}
                <code className="break-all">{result.url}</code>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">UA:</span>{" "}
                <code className="break-all">{result.userAgentUsed}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Content-Type:</span>{" "}
                {result.contentType ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Vastauksen koko:</span>{" "}
                {result.bodyBytes} tavua
              </div>
            </div>

            {result.error && (
              <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-destructive">
                {result.error}
              </div>
            )}

            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">
                Vastauksen alku (maks. 4000 merkkiä)
              </div>
              <pre className="max-h-96 overflow-auto rounded bg-muted p-2 text-xs">
{result.bodyPreview || "(tyhjä)"}
              </pre>
            </div>

            <details>
              <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                Vastauksen headerit
              </summary>
              <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-2 text-xs">
{Object.entries(result.headers)
  .map(([k, v]) => `${k}: ${v}`)
  .join("\n")}
              </pre>
            </details>
          </div>
        )}
      </main>
    </div>
  );
}
