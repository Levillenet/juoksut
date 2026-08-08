import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronRight, Trash2, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { competitionIndexQueryOptions } from "@/lib/tuloslista-queries";
import {
  beginTimeMs,
  compareByBeginTime,
  formatTime,
  helsinkiDateKey,
  isRunningEvent,
  type Round,
} from "@/lib/tuloslista";
import { athleteKey } from "@/lib/watch-store";
import {
  addAssignment,
  closeCall,
  fetchAllOfficials,
  fetchAssignments,
  fetchAvailabilityFor,
  fetchCalls,
  openCall,
  removeAssignment,
  setAssignmentStatus,
  STATUS_LABEL_FI,
  type OfficialAssignment,
  type OfficialChild,
  type OfficialProfile,
} from "@/lib/officials";

export const Route = createFileRoute("/toimitsija/kisa/$competitionId")({
  component: OfficialsCompetition,
});

interface FieldEvent {
  round: Round;
  athleteKeys: Set<string>;
  participants: number;
}

type Tier = "guardian" | "attached" | "available" | "other";

const TIER_LABEL: Record<Tier, string> = {
  guardian: "Huoltaja lajissa",
  attached: "Kiinnittänyt urheilijan",
  available: "Ilmoittautunut käytettäväksi",
  other: "Muu toimitsija",
};

const TIER_ORDER: Tier[] = ["guardian", "attached", "available", "other"];

function OfficialsCompetition() {
  const { competitionId } = Route.useParams();
  const compId = Number(competitionId);
  const { user, isAdmin, isOfficial } = useAuth();
  const canManage = isAdmin || isOfficial;

  const indexQuery = useQuery(
    competitionIndexQueryOptions(compId, { skipBaselines: true }),
  );

  const [profiles, setProfiles] = useState<OfficialProfile[]>([]);
  const [children, setChildren] = useState<OfficialChild[]>([]);
  const [availableUserIds, setAvailableUserIds] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<OfficialAssignment[]>([]);
  const [callOpen, setCallOpen] = useState(false);
  const [openUntil, setOpenUntil] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const reloadAssignments = async () => setAssignments(await fetchAssignments(compId));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [all, avail, asg, calls] = await Promise.all([
          fetchAllOfficials(),
          fetchAvailabilityFor(compId),
          fetchAssignments(compId),
          fetchCalls(),
        ]);
        if (cancelled) return;
        setProfiles(all.profiles);
        setChildren(all.children);
        setAvailableUserIds(new Set(avail.map((a) => a.user_id)));
        setAssignments(asg);
        setCallOpen(calls.some((c) => c.competition_id === compId));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Lataus epäonnistui");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [compId]);

  const competitionName = indexQuery.data?.name ?? "";

  /** Kenttälajit aikajärjestyksessä; juoksut ja viestit rajataan pois. */
  const fieldEvents = useMemo<FieldEvent[]>(() => {
    const entries = indexQuery.data?.entries ?? [];
    const byRound = new Map<number, FieldEvent>();
    for (const e of entries) {
      if (isRunningEvent(e.round)) continue;
      let fe = byRound.get(e.round.Id);
      if (!fe) {
        fe = { round: e.round, athleteKeys: new Set(), participants: 0 };
        byRound.set(e.round.Id, fe);
      }
      const key = athleteKey(
        e.alloc.Surname,
        e.alloc.Firstname,
        e.alloc.Organization?.Id ?? null,
      );
      if (!fe.athleteKeys.has(key)) {
        fe.athleteKeys.add(key);
        fe.participants += 1;
      }
    }
    return Array.from(byRound.values()).sort((a, b) =>
      compareByBeginTime(a.round, b.round),
    );
  }, [indexQuery.data]);

  const profileById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );

  const childrenByAthlete = useMemo(() => {
    const m = new Map<string, OfficialChild[]>();
    for (const c of children) {
      const arr = m.get(c.athlete_key) ?? [];
      arr.push(c);
      m.set(c.athlete_key, arr);
    }
    return m;
  }, [children]);

  const assignmentsByRound = useMemo(() => {
    const m = new Map<number, OfficialAssignment[]>();
    for (const a of assignments) {
      if (a.round_id == null) continue;
      const arr = m.get(a.round_id) ?? [];
      arr.push(a);
      m.set(a.round_id, arr);
    }
    return m;
  }, [assignments]);

  /** Toimitsija on varattu, jos hänellä on kiinnitys alle tunnin päässä. */
  const busyProfileIds = (round: Round): Set<string> => {
    const t = beginTimeMs(round.BeginDateTimeWithTZ);
    const busy = new Set<string>();
    for (const a of assignments) {
      if (a.round_id === round.Id) continue;
      const at = beginTimeMs(a.starts_at);
      if (Number.isFinite(at) && Math.abs(at - t) < 60 * 60_000) busy.add(a.profile_id);
    }
    return busy;
  };

  const suggestionsFor = (fe: FieldEvent) => {
    const assigned = new Set(
      (assignmentsByRound.get(fe.round.Id) ?? []).map((a) => a.profile_id),
    );
    const tierOf = new Map<string, Tier>();
    const reason = new Map<string, string>();
    for (const key of fe.athleteKeys) {
      for (const c of childrenByAthlete.get(key) ?? []) {
        const tier: Tier = c.is_guardian ? "guardian" : "attached";
        const cur = tierOf.get(c.profile_id);
        if (!cur || TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(cur)) {
          tierOf.set(c.profile_id, tier);
          reason.set(c.profile_id, `${c.surname} ${c.firstname}`);
        }
      }
    }
    for (const p of profiles) {
      if (tierOf.has(p.id)) continue;
      tierOf.set(p.id, availableUserIds.has(p.user_id) ? "available" : "other");
    }
    const busy = busyProfileIds(fe.round);
    return profiles
      .filter((p) => !assigned.has(p.id))
      .map((p) => ({
        profile: p,
        tier: tierOf.get(p.id) ?? "other",
        reason: reason.get(p.id) ?? null,
        busy: busy.has(p.id),
      }))
      .sort((a, b) => {
        if (a.busy !== b.busy) return a.busy ? 1 : -1;
        const t = TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
        if (t !== 0) return t;
        return a.profile.full_name.localeCompare(b.profile.full_name, "fi");
      });
  };

  const assign = async (fe: FieldEvent, profileId: string) => {
    if (!user) return;
    try {
      await addAssignment({
        competition_id: compId,
        event_id: fe.round.EventId,
        round_id: fe.round.Id,
        event_name: `${fe.round.Age ? `${fe.round.Age} ` : ""}${fe.round.EventName}`.trim(),
        age_class: fe.round.Age || null,
        starts_at: fe.round.BeginDateTimeWithTZ,
        profile_id: profileId,
        role_label: null,
        created_by: user.id,
      });
      await reloadAssignments();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kiinnitys epäonnistui");
    }
  };

  const toggleCall = async () => {
    if (!user) return;
    try {
      if (callOpen) {
        await closeCall(compId);
        setCallOpen(false);
        toast.success("Toimitsijahaku suljettu.");
      } else {
        await openCall({
          competition_id: compId,
          competition_name: competitionName || `Kilpailu ${compId}`,
          competition_date: fieldEvents[0]?.round.BeginDateTimeWithTZ ?? null,
          open_until: openUntil || null,
          message: null,
          opened_by: user.id,
        });
        setCallOpen(true);
        toast.success("Toimitsijahaku avattu, toimitsijat voivat ilmoittautua.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Toiminto epäonnistui");
    }
  };

  const missing = fieldEvents.filter(
    (fe) => (assignmentsByRound.get(fe.round.Id) ?? []).length === 0,
  ).length;
  const unconfirmed = assignments.filter((a) => a.status !== "confirmed").length;

  if (!canManage) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-sm text-muted-foreground">
        Toimitsijaluettelon rakentaminen on järjestelytoimikunnan käytössä.{" "}
        <Link to="/toimitsija" className="text-primary hover:underline">
          Palaa toimitsijasivulle
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <Link
        to="/toimitsija"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Toimitsijat
      </Link>
      <h1 className="text-xl font-bold">{competitionName || `Kilpailu ${compId}`}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Kenttälajien toimitsijaluettelo. Juoksulajit eivät näy tässä näkymässä.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm shadow-sm">
        <span>
          Lajeja: <strong>{fieldEvents.length}</strong>
        </span>
        <span className="text-muted-foreground">·</span>
        <span>
          Ilman toimitsijaa: <strong>{missing}</strong>
        </span>
        <span className="text-muted-foreground">·</span>
        <span>
          Varmennusta odottaa: <strong>{unconfirmed}</strong>
        </span>
        <div className="ml-auto flex items-center gap-2">
          {!callOpen && (
            <Input
              type="date"
              className="h-9 w-40"
              value={openUntil}
              onChange={(e) => setOpenUntil(e.target.value)}
              aria-label="Ilmoittautuminen auki asti"
            />
          )}
          <Button size="sm" variant={callOpen ? "secondary" : "default"} onClick={() => void toggleCall()}>
            {callOpen ? "Sulje toimitsijahaku" : "Avaa toimitsijahaku"}
          </Button>
        </div>
      </div>

      {(indexQuery.isFetching && !indexQuery.data) || loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Ladataan kilpailun lajeja…</p>
      ) : fieldEvents.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Tälle kilpailulle ei löytynyt kenttälajeja.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {fieldEvents.map((fe) => {
            const rows = assignmentsByRound.get(fe.round.Id) ?? [];
            const isOpen = expanded.has(fe.round.Id);
            return (
              <li key={fe.round.Id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-16 shrink-0">
                    <p className="text-sm font-bold tabular-nums">
                      {formatTime(fe.round.BeginDateTimeWithTZ)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {helsinkiDateKey(fe.round.BeginDateTimeWithTZ)}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {fe.round.Age} {fe.round.EventName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fe.participants} osallistujaa · {rows.length} toimitsijaa
                    </p>
                  </div>
                </div>

                {rows.length > 0 && (
                  <ul className="mt-3 divide-y divide-border">
                    {rows.map((a) => {
                      const p = profileById.get(a.profile_id);
                      return (
                        <li key={a.id} className="flex items-center gap-2 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {p?.full_name ?? "Tuntematon"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {p?.phone ?? ""} {p?.email ? `· ${p.email}` : ""}
                            </p>
                          </div>
                          <select
                            className="h-8 rounded-md border bg-background px-2 text-xs"
                            value={a.status}
                            onChange={(e) => {
                              const next = e.target.value as OfficialAssignment["status"];
                              setAssignments((prev) =>
                                prev.map((x) => (x.id === a.id ? { ...x, status: next } : x)),
                              );
                              void setAssignmentStatus(a.id, next);
                            }}
                          >
                            {(
                              ["proposed", "requested", "confirmed", "declined"] as const
                            ).map((s) => (
                              <option key={s} value={s}>
                                {STATUS_LABEL_FI[s]}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Poista toimitsija"
                            onClick={() => {
                              void (async () => {
                                await removeAssignment(a.id);
                                setAssignments((prev) => prev.filter((x) => x.id !== a.id));
                              })();
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(fe.round.Id)) next.delete(fe.round.Id);
                      else next.add(fe.round.Id);
                      return next;
                    })
                  }
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="ml-1">Ehdota toimitsijoita</span>
                </Button>

                {isOpen && (
                  <ul className="mt-2 divide-y divide-border rounded-lg border">
                    {suggestionsFor(fe).length === 0 && (
                      <li className="p-3 text-xs text-muted-foreground">
                        Toimitsijaprofiileja ei vielä ole.
                      </li>
                    )}
                    {suggestionsFor(fe).map((s) => (
                      <li key={s.profile.id} className="flex items-center gap-2 p-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{s.profile.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {TIER_LABEL[s.tier]}
                            {s.reason ? ` · ${s.reason}` : ""}
                            {s.busy ? " · varattu samaan aikaan" : ""}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={s.tier === "guardian" ? "default" : "outline"}
                          onClick={() => void assign(fe, s.profile.id)}
                        >
                          <UserPlus className="h-4 w-4" />
                          <span className="ml-1">Kiinnitä</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
