import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MapPin, Search, Save } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocode.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/club-locations")({
  head: () => ({
    meta: [{ title: "Seurojen sijainnit – Tuloslista" }],
  }),
  component: Gate,
});

function Gate() {
  const { role, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  if (!role) return <Navigate to="/login" />;
  return <Page />;
}

interface OrgRow {
  organization_id: number;
  organization_name: string;
  city: string;
  lat: number | null;
  lng: number | null;
}

interface KnownOrg {
  id: number;
  name: string;
}

function Page() {
  const queryClient = useQueryClient();
  const geocodeFn = useServerFn(geocodeAddress);

  const orgsQuery = useQuery({
    queryKey: ["admin", "known-organizations"],
    queryFn: async (): Promise<KnownOrg[]> => {
      const { data, error } = await supabase
        .from("athlete_results")
        .select("organization_id, organization")
        .not("organization_id", "is", null)
        .limit(1000);
      if (error) throw error;
      const map = new Map<number, string>();
      for (const r of (data ?? []) as Array<{
        organization_id: number | null;
        organization: string;
      }>) {
        if (r.organization_id != null && !map.has(r.organization_id)) {
          map.set(r.organization_id, r.organization);
        }
      }
      return Array.from(map.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, "fi"));
    },
    staleTime: 5 * 60_000,
  });

  const locationsQuery = useQuery({
    queryKey: ["admin", "org-locations"],
    queryFn: async (): Promise<OrgRow[]> => {
      const { data, error } = await supabase
        .from("organization_locations")
        .select("organization_id, organization_name, city, lat, lng");
      if (error) throw error;
      return (data ?? []) as OrgRow[];
    },
    staleTime: 60_000,
  });

  const merged = useMemo(() => {
    const known = orgsQuery.data ?? [];
    const locs = new Map(
      (locationsQuery.data ?? []).map((l) => [l.organization_id, l]),
    );
    return known.map((k) => {
      const existing = locs.get(k.id);
      return {
        organization_id: k.id,
        organization_name: k.name,
        city: existing?.city ?? "",
        lat: existing?.lat ?? null,
        lng: existing?.lng ?? null,
      } as OrgRow;
    });
  }, [orgsQuery.data, locationsQuery.data]);

  const [filter, setFilter] = useState("");
  const [showOnly, setShowOnly] = useState<"all" | "missing">("all");

  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return merged.filter((m) => {
      if (showOnly === "missing" && m.lat != null && m.lng != null) return false;
      if (!f) return true;
      return (
        m.organization_name.toLowerCase().includes(f) ||
        m.city.toLowerCase().includes(f)
      );
    });
  }, [merged, filter, showOnly]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "org-locations"] });
    queryClient.invalidateQueries({ queryKey: ["season-stats"] });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" aria-label="Takaisin">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">Seurojen sijainnit</h1>
            <p className="truncate text-xs text-muted-foreground">
              Käytetään matkalaskennassa kausitilastoissa
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 px-4 py-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Hae seuraa tai paikkakuntaa…"
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={showOnly}
            onChange={(e) => setShowOnly(e.target.value as "all" | "missing")}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Kaikki</option>
            <option value="missing">Vain ilman sijaintia</option>
          </select>
        </div>

        {orgsQuery.isLoading || locationsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Ladataan…</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border bg-card">
            {visible.map((row) => (
              <OrgRowEditor
                key={row.organization_id}
                row={row}
                geocodeFn={geocodeFn}
                onSaved={refresh}
              />
            ))}
            {visible.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                Ei seuroja näkyvissä.
              </li>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}

function OrgRowEditor({
  row,
  geocodeFn,
  onSaved,
}: {
  row: OrgRow;
  geocodeFn: (args: { data: { query: string } }) => Promise<{
    result: { lat: number; lng: number; displayName: string } | null;
  }>;
  onSaved: () => void;
}) {
  const [city, setCity] = useState(row.city);
  const [lat, setLat] = useState<string>(row.lat != null ? String(row.lat) : "");
  const [lng, setLng] = useState<string>(row.lng != null ? String(row.lng) : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setCity(row.city);
    setLat(row.lat != null ? String(row.lat) : "");
    setLng(row.lng != null ? String(row.lng) : "");
  }, [row.city, row.lat, row.lng]);

  const dirty =
    city !== row.city ||
    (lat || row.lat != null ? String(row.lat ?? "") !== lat : false) ||
    (lng || row.lng != null ? String(row.lng ?? "") !== lng : false);

  const onGeocode = async () => {
    if (!city.trim()) {
      setMsg("Anna paikkakunta ensin.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { result } = await geocodeFn({
        data: { query: `${city}, ${row.organization_name}` },
      });
      if (!result) {
        const fallback = await geocodeFn({ data: { query: city } });
        if (!fallback.result) {
          setMsg("Ei löytynyt.");
          return;
        }
        setLat(String(fallback.result.lat));
        setLng(String(fallback.result.lng));
        setMsg(fallback.result.displayName);
      } else {
        setLat(String(result.lat));
        setLng(String(result.lng));
        setMsg(result.displayName);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Virhe");
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("organization_locations").upsert(
        {
          organization_id: row.organization_id,
          organization_name: row.organization_name,
          city: city.trim(),
          lat: lat ? parseFloat(lat) : null,
          lng: lng ? parseFloat(lng) : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" },
      );
      if (error) throw error;
      setMsg("Tallennettu.");
      onSaved();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Virhe");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="px-3 py-3">
      <div className="mb-2 flex items-center gap-2">
        <MapPin
          className={`h-4 w-4 shrink-0 ${
            row.lat != null && row.lng != null ? "text-primary" : "text-muted-foreground"
          }`}
        />
        <h3 className="flex-1 text-sm font-semibold">{row.organization_name}</h3>
        <span className="text-[10px] text-muted-foreground">#{row.organization_id}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Paikkakunta"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="text"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="Lat"
          className="h-9 w-24 rounded-md border border-input bg-background px-2 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="text"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          placeholder="Lng"
          className="h-9 w-24 rounded-md border border-input bg-background px-2 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onGeocode}
            disabled={busy || !city.trim()}
            type="button"
          >
            <Search className="h-3 w-3" />
          </Button>
          <Button size="sm" onClick={onSave} disabled={busy || (!dirty && !city)} type="button">
            <Save className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {msg && <p className="mt-1 text-[10px] text-muted-foreground">{msg}</p>}
    </li>
  );
}
