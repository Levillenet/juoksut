import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { probeTuloslista, type ProbeResult } from "@/lib/tuloslista-probe.functions";

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
        <p className="text-sm text-muted-foreground">
          Yksi suora kutsu osoitteeseen{" "}
          <code className="rounded bg-muted px-1">cached-public-api.tuloslista.com</code>,
          ohittaa oman reunavälimuistin. Käytä tarkistamaan onko esto vielä
          päällä.
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
