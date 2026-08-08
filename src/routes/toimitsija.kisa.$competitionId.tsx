import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  Printer,
  Send,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  createManualProfile,
  fetchAllOfficials,
  fetchAssignments,
  fetchAvailabilityFor,
  fetchCall,
  fetchDayAvailabilityFor,
  fetchRequirements,
  openCall,
  removeAssignment,
  requestConfirmations,
  setAssignmentStatus,
  setRequirement,
  STATUS_LABEL_FI,
  type EventRequirement,
  type OfficialAssignment,
  type OfficialCallFull,
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

const DEFAULT_MIN_OFFICIALS = 2;

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
  const [availableProfileIds, setAvailableProfileIds] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<OfficialAssignment[]>([]);
  const [requirements, setRequirements] = useState<EventRequirement[]>([]);
  const [call, setCall] = useState<OfficialCallFull | null>(null);
  const [openUntil, setOpenUntil] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [loading, setLoading] = useState(true);

  const reloadAssignments = async () => setAssignments(await fetchAssignments(compId));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [all, avail, dayAvail, asg, c, reqs] = await Promise.all([
          fetchAllOfficials(),
          fetchAvailabilityFor(compId),
          fetchDayAvailabilityFor(compId),
          fetchAssignments(compId),
          fetchCall(compId),
          fetchRequirements(compId),
        ]);
        if (cancelled) return;
        setProfiles(all.profiles);
        setChildren(all.children);
        const byUser = new Map(
          all.profiles.filter((p) => p.user_id).map((p) => [p.user_id as string, p.id]),
        );
        const ids = new Set<string>();
        for (const a of avail) {
          const pid = byUser.get(a.user_id);
          if (pid) ids.add(pid);
        }
        for (const d of dayAvail) if (d.available) ids.add(d.profile_id);
        setAvailableProfileIds(ids);
        setAssignments(asg);
        setCall(c);
        setRequirements(reqs);
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

  const minByRound = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of requirements) m.set(r.round_id, r.min_officials);
    return m;
  }, [requirements]);

  const minFor = (roundId: number) => minByRound.get(roundId) ?? DEFAULT_MIN_OFFICIALS;

  const saveMin = async (fe: FieldEvent, value: number) => {
    if (!user) return;
    const clean = Math.max(0, Math.min(30, Math.round(value)));
    setRequirements((prev) => {
      const rest = prev.filter((r) => r.round_id !== fe.round.Id);
      return [
        ...rest,
        {
          id: `local-${fe.round.Id}`,
          competition_id: compId,
          round_id: fe.round.Id,
          event_id: fe.round.EventId,
          event_name: eventLabel(fe.round),
          age_class: fe.round.Age || null,
          starts_at: fe.round.BeginDateTimeWithTZ,
          min_officials: clean,
        },
      ];
    });
    try {
      await setRequirement({
        competition_id: compId,
        round_id: fe.round.Id,
        event_id: fe.round.EventId,
        event_name: eventLabel(fe.round),
        age_class: fe.round.Age || null,
        starts_at: fe.round.BeginDateTimeWithTZ,
        min_officials: clean,
        created_by: user.id,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tallennus epäonnistui");
    }
  };

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
      tierOf.set(p.id, availableProfileIds.has(p.id) ? "available" : "other");
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
        event_name: eventLabel(fe.round),
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

  /** Nimi käsin: luodaan toimitsijakortti ja kiinnitetään se suoraan lajiin. */
  const addManual = async (fe: FieldEvent) => {
    if (!user) return;
    const name = manualName.trim();
    if (!name) {
      toast.error("Kirjoita toimitsijan nimi.");
      return;
    }
    try {
      const p = await createManualProfile({
        full_name: name,
        email: null,
        phone: manualPhone.trim() || null,
        club: null,
        created_by: user.id,
      });
      setProfiles((prev) =>
        [...prev, p].sort((a, b) => a.full_name.localeCompare(b.full_name, "fi")),
      );
      await assign(fe, p.id);
      setManualName("");
      setManualPhone("");
      toast.success(`${name} lisätty ja kiinnitetty lajiin.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lisäys epäonnistui");
    }
  };

  const toggleCall = async () => {
    if (!user) return;
    try {
      if (call) {
        await closeCall(compId);
        setCall(null);
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
        setCall(await fetchCall(compId));
        toast.success("Toimitsijahaku avattu, toimitsijat voivat ilmoittautua.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Toiminto epäonnistui");
    }
  };

  const signupUrl =
    call && typeof window !== "undefined"
      ? `${window.location.origin}/toimitsija/haku/${compId}`
      : "";

  const sendRequests = async () => {
    try {
      const n = await requestConfirmations(compId);
      await reloadAssignments();
      toast.success(
        n === 0
          ? "Kaikki kiinnitykset on jo pyydetty tai varmennettu."
          : `Varmennuspyyntö merkitty ${n} kiinnitykselle.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Toiminto epäonnistui");
    }
  };

  const understaffed = fieldEvents.filter(
    (fe) => (assignmentsByRound.get(fe.round.Id) ?? []).length < minFor(fe.round.Id),
  ).length;
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
        <span className={understaffed > 0 ? "text-destructive" : undefined}>
          Vajaita: <strong>{understaffed}</strong>
        </span>
        <span className="text-muted-foreground">·</span>
        <span>
          Varmennusta odottaa: <strong>{unconfirmed}</strong>
        </span>
        <div className="ml-auto flex items-center gap-2">
          {!call && (
            <Input
              type="date"
              className="h-9 w-40"
              value={openUntil}
              onChange={(e) => setOpenUntil(e.target.value)}
              aria-label="Ilmoittautuminen auki asti"
            />
          )}
          <Button
            size="sm"
            variant={call ? "secondary" : "default"}
            onClick={() => void toggleCall()}
          >
            {call ? "Sulje toimitsijahaku" : "Avaa toimitsijahaku"}
          </Button>
        </div>
      </div>

      {call && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm shadow-sm">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Jaettava ilmoittautumislinkki
            </p>
            <p className="truncate text-xs">{signupUrl}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(signupUrl);
              toast.success("Linkki kopioitu. Jaa se toimitsijoille.");
            }}
          >
            <Copy className="h-4 w-4" />
            <span className="ml-1">Kopioi linkki</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => void sendRequests()}>
            <Send className="h-4 w-4" />
            <span className="ml-1">Lähetä varmennuspyynnöt</span>
          </Button>
          <Link
            to="/toimitsija/aikataulu/$competitionId"
            params={{ competitionId: String(compId) }}
            className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-xs hover:bg-accent"
          >
            <Printer className="h-4 w-4" /> Tulosta aikataulut
          </Link>
        </div>
      )}

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
            const min = minFor(fe.round.Id);
            const short = rows.length < min;
            return (
              <li
                key={fe.round.Id}
                className={`rounded-xl border bg-card p-4 shadow-sm ${
                  short ? "border-destructive/60" : ""
                }`}
              >
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
                    <p className="flex items-center gap-1 truncate text-sm font-semibold">
                      {short && (
                        <AlertTriangle
                          className="h-4 w-4 shrink-0 text-destructive"
                          aria-label="Toimitsijoita puuttuu"
                        />
                      )}
                      {fe.round.Age} {fe.round.EventName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fe.participants} osallistujaa · {rows.length}/{min} toimitsijaa
                      {short ? " · vajaa" : ""}
                    </p>
                    <p className="text-xs">
                      {leadRow ? (
                        <span className="text-primary">
                          Lajijohtaja: {profileById.get(leadRow.profile_id)?.full_name ?? "?"}
                        </span>
                      ) : (
                        <span className="font-semibold text-destructive">
                          Lajijohtaja puuttuu
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="shrink-0">
                    <Label
                      htmlFor={`min-${fe.round.Id}`}
                      className="block text-[10px] uppercase text-muted-foreground"
                    >
                      Min.
                    </Label>
                    <Input
                      id={`min-${fe.round.Id}`}
                      type="number"
                      min={0}
                      max={30}
                      className="h-8 w-16"
                      value={min}
                      onChange={(e) => void saveMin(fe, Number(e.target.value))}
                    />
                  </div>
                </div>

                {rows.length > 0 && (
                  <ul className="mt-3 divide-y divide-border">
                    {rows.map((a) => {
                      const p = profileById.get(a.profile_id);
                      return (
                        <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                          <div className="min-w-40 flex-1">
                            <p className="flex items-center gap-1 truncate text-sm font-medium">
                              {a.is_lead && (
                                <Star className="h-3.5 w-3.5 shrink-0 fill-current text-primary" />
                              )}
                              {p?.full_name ?? "Tuntematon"}
                              {a.is_lead && (
                                <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                                  Lajijohtaja
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {p?.phone ?? ""} {p?.email ? `· ${p.email}` : ""}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={a.is_lead ? "secondary" : "outline"}
                            onClick={() => void toggleLead(fe, a)}
                          >
                            <Star className="h-4 w-4" />
                            <span className="ml-1">
                              {a.is_lead ? "Poista lajijohtajuus" : "Lajijohtajaksi"}
                            </span>
                          </Button>

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
                  <>
                    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border p-2">
                      <div className="min-w-40 flex-1">
                        <Label
                          htmlFor={`manual-${fe.round.Id}`}
                          className="text-[10px] uppercase text-muted-foreground"
                        >
                          Lisää toimitsija nimellä
                        </Label>
                        <Input
                          id={`manual-${fe.round.Id}`}
                          className="h-8"
                          placeholder="Etunimi Sukunimi"
                          value={manualName}
                          onChange={(e) => setManualName(e.target.value)}
                        />
                      </div>
                      <div className="w-32">
                        <Label
                          htmlFor={`manual-phone-${fe.round.Id}`}
                          className="text-[10px] uppercase text-muted-foreground"
                        >
                          Puhelin
                        </Label>
                        <Input
                          id={`manual-phone-${fe.round.Id}`}
                          className="h-8"
                          value={manualPhone}
                          onChange={(e) => setManualPhone(e.target.value)}
                        />
                      </div>
                      <Button size="sm" onClick={() => void addManual(fe)}>
                        <UserPlus className="h-4 w-4" />
                        <span className="ml-1">Lisää</span>
                      </Button>
                    </div>
                    <ul className="mt-2 divide-y divide-border rounded-lg border">
                      {suggestionsFor(fe).length === 0 && (
                        <li className="p-3 text-xs text-muted-foreground">
                          Toimitsijaprofiileja ei vielä ole.
                        </li>
                      )}
                      {suggestionsFor(fe).map((s) => (
                        <li key={s.profile.id} className="flex flex-wrap items-center gap-2 p-2">
                          <div className="min-w-40 flex-1">
                            <p className="truncate text-sm font-medium">{s.profile.full_name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {TIER_LABEL[s.tier]}
                              {s.reason ? ` · ${s.reason}` : ""}
                              {s.canLead ? " · voi toimia lajijohtajana" : ""}
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
                          <Button
                            size="sm"
                            variant={s.canLead ? "default" : "outline"}
                            onClick={() => void assign(fe, s.profile.id, true)}
                          >
                            <Star className="h-4 w-4" />
                            <span className="ml-1">Lajijohtajaksi</span>
                          </Button>
                        </li>
                      ))}

                    </ul>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function eventLabel(r: Round): string {
  return `${r.Age ? `${r.Age} ` : ""}${r.EventName}`.trim();
}
