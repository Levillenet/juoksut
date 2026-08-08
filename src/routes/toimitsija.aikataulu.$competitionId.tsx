import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { competitionScheduleQueryOptions } from "@/lib/tuloslista-queries";
import { formatTime, helsinkiDateKey } from "@/lib/tuloslista";
import {
  fetchAllOfficials,
  fetchAssignments,
  fetchMyProfile,
  STATUS_LABEL_FI,
  type AssignmentStatus,
  type OfficialAssignment,
  type OfficialProfile,
} from "@/lib/officials";

export const Route = createFileRoute("/toimitsija/aikataulu/$competitionId")({
  component: OfficialSchedule,
});

function OfficialSchedule() {
  const { competitionId } = Route.useParams();
  const compId = Number(competitionId);
  const { user, isAdmin, isOfficial, isOrganizer } = useAuth();
  const canManage = isOrganizer;
  const userId = user?.id ?? "";

  const scheduleQuery = useQuery(competitionScheduleQueryOptions(compId));

  const [profile, setProfile] = useState<OfficialProfile | null>(null);
  const [profiles, setProfiles] = useState<OfficialProfile[]>([]);
  const [assignments, setAssignments] = useState<OfficialAssignment[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [p, asg, all] = await Promise.all([
          fetchMyProfile(userId),
          fetchAssignments(compId),
          canManage ? fetchAllOfficials() : Promise.resolve({ profiles: [], children: [] }),
        ]);
        if (cancelled) return;
        setProfile(p);
        setAssignments(asg);
        setProfiles(all.profiles);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Lataus epäonnistui");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [compId, userId, canManage]);

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const rows = useMemo(() => {
    const list = showAll && canManage
      ? assignments
      : assignments.filter((a) => a.profile_id === profile?.id);
    return [...list].sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""));
  }, [assignments, profile, showAll, canManage]);

  const byDay = useMemo(() => {
    const m = new Map<string, OfficialAssignment[]>();
    for (const a of rows) {
      const key = a.starts_at ? helsinkiDateKey(a.starts_at) : "Ajankohta avoin";
      const arr = m.get(key) ?? [];
      arr.push(a);
      m.set(key, arr);
    }
    return Array.from(m.entries());
  }, [rows]);

  const title = scheduleQuery.data?.name || `Kilpailu ${compId}`;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 print:max-w-none print:px-0">
      <div className="print:hidden">
        <Link
          to="/toimitsija"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Toimitsijat
        </Link>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {showAll && canManage
              ? "Kaikkien toimitsijoiden aikataulu"
              : `Toimitsija-aikataulu: ${profile?.full_name ?? "oma"}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2 print:hidden">
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Vain omat" : "Kaikki toimitsijat"}
            </Button>
          )}
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            <span className="ml-1">Tulosta</span>
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Ei toimitsijavuoroja tässä kilpailussa.
        </p>
      ) : (
        byDay.map(([day, list]) => (
          <section key={day} className="mt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {day}
            </h2>
            <ul className="mt-2 divide-y divide-border rounded-lg border">
              {list.map((a) => (
                <li key={a.id} className="flex items-center gap-3 p-2">
                  <span className="w-12 shrink-0 text-sm font-bold tabular-nums">
                    {a.starts_at ? formatTime(a.starts_at) : "–"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-sm font-medium">
                      {a.event_name}
                      {a.is_lead && (
                        <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                          Lajijohtaja
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {showAll && canManage
                        ? `${profileById.get(a.profile_id)?.full_name ?? "Tuntematon"} · `
                        : ""}
                      {STATUS_LABEL_FI[a.status as AssignmentStatus] ?? a.status}
                      {a.is_lead ? " · lajijohtaja" : ""}
                      {a.role_label ? ` · ${a.role_label}` : ""}
                    </p>
                  </div>

                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
