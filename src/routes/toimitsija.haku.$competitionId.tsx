import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { competitionScheduleQueryOptions } from "@/lib/tuloslista-queries";
import { formatTime, type Round } from "@/lib/tuloslista";
import {
  fieldDays,
  formatHour,
  hourOptions,
  minutesToTime,
  roundInWindow,
} from "@/lib/officials-schedule";
import {
  fetchAssignments,
  fetchCall,
  fetchMyDayAvailability,
  fetchMyProfile,
  fetchRequirements,
  removeAssignment,
  saveDayAvailability,
  selfAssign,
  type DayAvailability,
  type EventRequirement,
  type OfficialAssignment,
  type OfficialCallFull,
  type OfficialProfile,
} from "@/lib/officials";

export const Route = createFileRoute("/toimitsija/haku/$competitionId")({
  component: OfficialSignup,
});

function OfficialSignup() {
  const { competitionId } = Route.useParams();
  const compId = Number(competitionId);
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const scheduleQuery = useQuery(competitionScheduleQueryOptions(compId));
  const days = useMemo(() => fieldDays(scheduleQuery.data?.rounds), [scheduleQuery.data]);

  const [profile, setProfile] = useState<OfficialProfile | null>(null);
  const [call, setCall] = useState<OfficialCallFull | null>(null);
  const [windows, setWindows] = useState<Record<string, DayAvailability>>({});
  const [assignments, setAssignments] = useState<OfficialAssignment[]>([]);
  const [requirements, setRequirements] = useState<EventRequirement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [p, c, asg, reqs] = await Promise.all([
          fetchMyProfile(userId),
          fetchCall(compId),
          fetchAssignments(compId),
          fetchRequirements(compId),
        ]);
        if (cancelled) return;
        setProfile(p);
        setCall(c);
        setAssignments(asg);
        setRequirements(reqs);
        if (p) {
          const rows = await fetchMyDayAvailability(p.id, compId);
          if (cancelled) return;
          const map: Record<string, DayAvailability> = {};
          for (const r of rows) map[r.day] = r;
          setWindows(map);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Lataus epäonnistui");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [compId, userId]);

  const minByRound = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of requirements) m.set(r.round_id, r.min_officials);
    return m;
  }, [requirements]);

  const countByRound = useMemo(() => {
    const m = new Map<number, number>();
    for (const a of assignments) {
      if (a.round_id == null) continue;
      m.set(a.round_id, (m.get(a.round_id) ?? 0) + 1);
    }
    return m;
  }, [assignments]);

  const mine = useMemo(
    () => new Map(assignments.filter((a) => a.profile_id === profile?.id).map((a) => [a.round_id, a])),
    [assignments, profile],
  );

  const saveWindow = async (
    day: string,
    patch: Partial<Pick<DayAvailability, "available" | "start_time" | "end_time">>,
  ) => {
    if (!profile) return;
    const cur = windows[day];
    const next: DayAvailability = {
      id: cur?.id ?? `local-${day}`,
      profile_id: profile.id,
      user_id: userId,
      competition_id: compId,
      day,
      available: patch.available ?? cur?.available ?? true,
      start_time: patch.start_time !== undefined ? patch.start_time : (cur?.start_time ?? null),
      end_time: patch.end_time !== undefined ? patch.end_time : (cur?.end_time ?? null),
    };
    setWindows((m) => ({ ...m, [day]: next }));
    try {
      await saveDayAvailability({
        profile_id: profile.id,
        user_id: userId,
        competition_id: compId,
        day,
        available: next.available,
        start_time: next.start_time,
        end_time: next.end_time,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tallennus epäonnistui");
    }
  };

  const toggleRound = async (round: Round, day: string) => {
    if (!profile) return;
    const existing = mine.get(round.Id);
    try {
      if (existing) {
        await removeAssignment(existing.id);
        setAssignments((prev) => prev.filter((a) => a.id !== existing.id));
      } else {
        await selfAssign({
          competition_id: compId,
          event_id: round.EventId,
          round_id: round.Id,
          event_name: `${round.Age ? `${round.Age} ` : ""}${round.EventName}`.trim(),
          age_class: round.Age || null,
          starts_at: round.BeginDateTimeWithTZ,
          day,
          profile_id: profile.id,
          created_by: userId,
        });
        setAssignments(await fetchAssignments(compId));
        toast.success("Ilmoittautuminen tallennettu.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Toiminto epäonnistui");
    }
  };

  if (loading || scheduleQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <Link
        to="/toimitsija"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Toimitsijat
      </Link>
      <h1 className="text-xl font-bold">
        {call?.competition_name || scheduleQuery.data?.name || `Kilpailu ${compId}`}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ilmoittaudu toimitsijaksi kenttälajeihin. Kerro ensin, milloin olet käytettävissä.
      </p>
      {call?.message && <p className="mt-2 text-sm">{call.message}</p>}
      {!call && (
        <p className="mt-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Toimitsijahaku ei ole tällä hetkellä auki tähän kilpailuun. Voit silti katsoa lajit.
        </p>
      )}

      {!profile ? (
        <p className="mt-4 rounded-lg border p-3 text-sm">
          Luo ensin toimitsijaprofiili{" "}
          <Link to="/toimitsija" className="text-primary hover:underline">
            toimitsijasivulla
          </Link>
          , niin voit ilmoittautua.
        </p>
      ) : (
        <>
          <section className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="text-base font-semibold">Milloin olen käytettävissä</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Oletus on koko päivä. Rajaa kellonaikoja, jos pääset vain osaksi päivää.
            </p>
            <ul className="mt-3 space-y-3">
              {days.map((d) => {
                const w = windows[d.isoDay];
                const available = w?.available ?? false;
                const hours = hourOptions(d.startHour, d.endHour);
                return (
                  <li key={d.day} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{d.day}</p>
                        <p className="text-xs text-muted-foreground">
                          Kenttälajeja {d.rounds.length} · {formatHour(d.startHour)}–
                          {formatHour(d.endHour)}
                        </p>
                      </div>
                      <Switch
                        checked={available}
                        aria-label={`Käytettävissä ${d.day}`}
                        onCheckedChange={(v) => void saveWindow(d.isoDay, { available: v })}
                      />
                    </div>
                    {available && (
                      <div className="mt-2 flex items-center gap-2">
                        <div>
                          <Label className="text-[10px] uppercase text-muted-foreground">Alkaen</Label>
                          <select
                            className="block h-8 rounded-md border bg-background px-2 text-xs"
                            value={w?.start_time ?? ""}
                            onChange={(e) =>
                              void saveWindow(d.isoDay, { start_time: e.target.value || null })
                            }
                          >
                            <option value="">Koko päivä</option>
                            {hours.map((h) => (
                              <option key={h} value={minutesToTime(h * 60)}>
                                {formatHour(h)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase text-muted-foreground">Asti</Label>
                          <select
                            className="block h-8 rounded-md border bg-background px-2 text-xs"
                            value={w?.end_time ?? ""}
                            onChange={(e) =>
                              void saveWindow(d.isoDay, { end_time: e.target.value || null })
                            }
                          >
                            <option value="">Koko päivä</option>
                            {hours.map((h) => (
                              <option key={h} value={minutesToTime(h * 60)}>
                                {formatHour(h)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
              {days.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Kilpailun kenttälajien aikataulua ei ole vielä julkaistu.
                </li>
              )}
            </ul>
          </section>

          <section className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Lajit, joihin voin ilmoittautua</h2>
              <Link
                to="/toimitsija/aikataulu/$competitionId"
                params={{ competitionId: String(compId) }}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Printer className="h-4 w-4" /> Oma aikataulu
              </Link>
            </div>
            {days.map((d) => {
              const w = windows[d.isoDay];
              if (!w?.available) return null;
              const rounds = d.rounds.filter((r) => roundInWindow(r, w));
              return (
                <div key={d.day} className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {d.day}
                  </p>
                  <ul className="mt-1 divide-y divide-border rounded-lg border">
                    {rounds.map((r) => {
                      const taken = countByRound.get(r.Id) ?? 0;
                      const min = minByRound.get(r.Id) ?? 2;
                      const isMine = mine.has(r.Id);
                      return (
                        <li key={r.Id} className="flex items-center gap-2 p-2">
                          <span className="w-12 shrink-0 text-xs font-bold tabular-nums">
                            {formatTime(r.BeginDateTimeWithTZ)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {r.Age} {r.EventName}
                            </p>
                            <p
                              className={`text-xs ${
                                taken < min ? "text-destructive" : "text-muted-foreground"
                              }`}
                            >
                              {taken}/{min} toimitsijaa{taken < min ? " · tarvitaan lisää" : ""}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={isMine ? "secondary" : "default"}
                            onClick={() => void toggleRound(r, d.isoDay)}
                          >
                            {isMine ? (
                              <>
                                <Check className="h-4 w-4" />
                                <span className="ml-1">Ilmoittauduttu</span>
                              </>
                            ) : (
                              "Ilmoittaudun"
                            )}
                          </Button>
                        </li>
                      );
                    })}
                    {rounds.length === 0 && (
                      <li className="p-3 text-xs text-muted-foreground">
                        Ei kenttälajeja valitsemassasi aikaikkunassa.
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
            {days.every((d) => !windows[d.isoDay]?.available) && (
              <p className="mt-2 text-sm text-muted-foreground">
                Merkitse ensin päivät, joina olet käytettävissä.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
