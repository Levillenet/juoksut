import { supabase } from "@/integrations/supabase/client";

export interface OfficialProfile {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  club: string | null;
  skills: string | null;
  notes: string | null;
  can_lead: boolean;
  lead_events: string[];
}


export interface OfficialChild {
  id: string;
  profile_id: string;
  athlete_key: string;
  surname: string;
  firstname: string;
  organization: string | null;
  organization_id: number | null;
  is_guardian: boolean;
}

export interface OfficialCall {
  id: string;
  competition_id: number;
  competition_name: string;
  competition_date: string | null;
  open_until: string | null;
  message: string | null;
}

export interface OfficialAvailability {
  id: string;
  user_id: string;
  competition_id: number;
  available: boolean;
  constraint_note: string | null;
}

export type AssignmentStatus = "proposed" | "requested" | "confirmed" | "declined";

export interface OfficialAssignment {
  id: string;
  competition_id: number;
  event_id: number | null;
  round_id: number | null;
  event_name: string;
  age_class: string | null;
  starts_at: string | null;
  profile_id: string;
  role_label: string | null;
  status: AssignmentStatus;
  is_lead: boolean;
}

export const STATUS_LABEL_FI: Record<AssignmentStatus, string> = {
  proposed: "Ehdotettu",
  requested: "Pyyntö lähetetty",
  confirmed: "Varmennettu",
  declined: "Kieltäytyi",
};

const PROFILE_COLS =
  "id, user_id, full_name, email, phone, club, skills, notes, can_lead, lead_events";
const CHILD_COLS =
  "id, profile_id, athlete_key, surname, firstname, organization, organization_id, is_guardian";
const CALL_COLS =
  "id, competition_id, competition_name, competition_date, open_until, message";
const ASSIGNMENT_COLS =
  "id, competition_id, event_id, round_id, event_name, age_class, starts_at, profile_id, role_label, status, is_lead";

export async function fetchMyProfile(userId: string): Promise<OfficialProfile | null> {
  const { data, error } = await supabase
    .from("official_profiles")
    .select(PROFILE_COLS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as OfficialProfile | null) ?? null;
}

export async function saveMyProfile(
  userId: string,
  values: {
    full_name: string;
    email: string;
    phone: string | null;
    club: string | null;
    skills: string | null;
    notes: string | null;
    can_lead: boolean;
    lead_events: string[];
  },
): Promise<OfficialProfile> {
  const { data, error } = await supabase
    .from("official_profiles")
    .upsert({ user_id: userId, ...values }, { onConflict: "user_id" })
    .select(PROFILE_COLS)
    .single();
  if (error) throw error;
  return data as OfficialProfile;
}

export async function fetchMyChildren(profileId: string): Promise<OfficialChild[]> {
  const { data, error } = await supabase
    .from("official_children")
    .select(CHILD_COLS)
    .eq("profile_id", profileId)
    .order("surname", { ascending: true });
  if (error) throw error;
  return (data ?? []) as OfficialChild[];
}

export async function addChild(
  profileId: string,
  userId: string,
  athlete: {
    athlete_key: string;
    surname: string;
    firstname: string;
    organization: string | null;
    organization_id: number | null;
  },
  isGuardian: boolean,
): Promise<void> {
  const { error } = await supabase.from("official_children").upsert(
    {
      profile_id: profileId,
      user_id: userId,
      is_guardian: isGuardian,
      ...athlete,
    },
    { onConflict: "profile_id,athlete_key" },
  );
  if (error) throw error;
}

export async function setChildGuardian(id: string, isGuardian: boolean): Promise<void> {
  const { error } = await supabase
    .from("official_children")
    .update({ is_guardian: isGuardian })
    .eq("id", id);
  if (error) throw error;
}

export async function removeChild(id: string): Promise<void> {
  const { error } = await supabase.from("official_children").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchCalls(): Promise<OfficialCall[]> {
  const { data, error } = await supabase
    .from("official_competition_calls")
    .select(CALL_COLS)
    .order("competition_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as OfficialCall[];
}

export async function openCall(values: {
  competition_id: number;
  competition_name: string;
  competition_date: string | null;
  open_until: string | null;
  message: string | null;
  opened_by: string;
}): Promise<void> {
  const { error } = await supabase
    .from("official_competition_calls")
    .upsert(values, { onConflict: "competition_id" });
  if (error) throw error;
}

export async function closeCall(competitionId: number): Promise<void> {
  const { error } = await supabase
    .from("official_competition_calls")
    .delete()
    .eq("competition_id", competitionId);
  if (error) throw error;
}

export async function fetchMyAvailability(userId: string): Promise<OfficialAvailability[]> {
  const { data, error } = await supabase
    .from("official_availability")
    .select("id, user_id, competition_id, available, constraint_note")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as OfficialAvailability[];
}

export async function setAvailability(
  userId: string,
  competitionId: number,
  available: boolean,
  note: string | null,
): Promise<void> {
  const { error } = await supabase.from("official_availability").upsert(
    {
      user_id: userId,
      competition_id: competitionId,
      available,
      constraint_note: note,
    },
    { onConflict: "user_id,competition_id" },
  );
  if (error) throw error;
}

/** Organizer view: every official profile plus their attached athletes. */
export async function fetchAllOfficials(): Promise<{
  profiles: OfficialProfile[];
  children: OfficialChild[];
}> {
  const [p, c] = await Promise.all([
    supabase.from("official_profiles").select(PROFILE_COLS).order("full_name"),
    supabase.from("official_children").select(CHILD_COLS),
  ]);
  if (p.error) throw p.error;
  if (c.error) throw c.error;
  return {
    profiles: (p.data ?? []) as OfficialProfile[],
    children: (c.data ?? []) as OfficialChild[],
  };
}

export async function fetchAvailabilityFor(
  competitionId: number,
): Promise<OfficialAvailability[]> {
  const { data, error } = await supabase
    .from("official_availability")
    .select("id, user_id, competition_id, available, constraint_note")
    .eq("competition_id", competitionId)
    .eq("available", true);
  if (error) throw error;
  return (data ?? []) as OfficialAvailability[];
}

export async function fetchAssignments(
  competitionId: number,
): Promise<OfficialAssignment[]> {
  const { data, error } = await supabase
    .from("official_assignments")
    .select(ASSIGNMENT_COLS)
    .eq("competition_id", competitionId);
  if (error) throw error;
  return (data ?? []) as OfficialAssignment[];
}

export async function addAssignment(values: {
  competition_id: number;
  event_id: number | null;
  round_id: number | null;
  event_name: string;
  age_class: string | null;
  starts_at: string | null;
  profile_id: string;
  role_label: string | null;
  created_by: string;
}): Promise<void> {
  const { error } = await supabase
    .from("official_assignments")
    .upsert({ ...values, status: "proposed" }, { onConflict: "competition_id,round_id,profile_id" });
  if (error) throw error;
}

export async function setAssignmentStatus(
  id: string,
  status: AssignmentStatus,
): Promise<void> {
  const { error } = await supabase
    .from("official_assignments")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function removeAssignment(id: string): Promise<void> {
  const { error } = await supabase.from("official_assignments").delete().eq("id", id);
  if (error) throw error;
}

/** Lajijohtaja: vain yksi per erä. Vanha merkintä puretaan ensin. */
export async function setAssignmentLead(
  competitionId: number,
  roundId: number | null,
  assignmentId: string,
): Promise<void> {
  let clear = supabase
    .from("official_assignments")
    .update({ is_lead: false })
    .eq("competition_id", competitionId)
    .eq("is_lead", true);
  clear = roundId === null ? clear.is("round_id", null) : clear.eq("round_id", roundId);
  const cleared = await clear;
  if (cleared.error) throw cleared.error;
  const { error } = await supabase
    .from("official_assignments")
    .update({ is_lead: true })
    .eq("id", assignmentId);
  if (error) throw error;
}

export async function clearAssignmentLead(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from("official_assignments")
    .update({ is_lead: false })
    .eq("id", assignmentId);
  if (error) throw error;
}

/* ---------- Vaihe 2: jaettava linkki, päiväkäytettävyys, minimimäärät ---------- */

export interface OfficialCallFull extends OfficialCall {
  share_token: string | null;
  open_from: string | null;
}

const CALL_FULL_COLS =
  "id, competition_id, competition_name, competition_date, open_until, message, share_token, open_from";

export async function fetchCall(competitionId: number): Promise<OfficialCallFull | null> {
  const { data, error } = await supabase
    .from("official_competition_calls")
    .select(CALL_FULL_COLS)
    .eq("competition_id", competitionId)
    .maybeSingle();
  if (error) throw error;
  return (data as OfficialCallFull | null) ?? null;
}

export async function fetchCallsFull(): Promise<OfficialCallFull[]> {
  const { data, error } = await supabase
    .from("official_competition_calls")
    .select(CALL_FULL_COLS)
    .order("competition_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as OfficialCallFull[];
}

export interface DayAvailability {
  id: string;
  profile_id: string;
  user_id: string;
  competition_id: number;
  day: string;
  available: boolean;
  start_time: string | null;
  end_time: string | null;
}

const DAY_COLS =
  "id, profile_id, user_id, competition_id, day, available, start_time, end_time";

export async function fetchMyDayAvailability(
  profileId: string,
  competitionId: number,
): Promise<DayAvailability[]> {
  const { data, error } = await supabase
    .from("official_day_availability")
    .select(DAY_COLS)
    .eq("profile_id", profileId)
    .eq("competition_id", competitionId);
  if (error) throw error;
  return (data ?? []) as DayAvailability[];
}

export async function fetchDayAvailabilityFor(
  competitionId: number,
): Promise<DayAvailability[]> {
  const { data, error } = await supabase
    .from("official_day_availability")
    .select(DAY_COLS)
    .eq("competition_id", competitionId);
  if (error) throw error;
  return (data ?? []) as DayAvailability[];
}

export async function saveDayAvailability(values: {
  profile_id: string;
  user_id: string;
  competition_id: number;
  day: string;
  available: boolean;
  start_time: string | null;
  end_time: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("official_day_availability")
    .upsert(values, { onConflict: "profile_id,competition_id,day" });
  if (error) throw error;
}

export interface EventRequirement {
  id: string;
  competition_id: number;
  round_id: number;
  event_id: number | null;
  event_name: string;
  age_class: string | null;
  starts_at: string | null;
  min_officials: number;
}

const REQ_COLS =
  "id, competition_id, round_id, event_id, event_name, age_class, starts_at, min_officials";

export async function fetchRequirements(
  competitionId: number,
): Promise<EventRequirement[]> {
  const { data, error } = await supabase
    .from("official_event_requirements")
    .select(REQ_COLS)
    .eq("competition_id", competitionId);
  if (error) throw error;
  return (data ?? []) as EventRequirement[];
}

export async function setRequirement(values: {
  competition_id: number;
  round_id: number;
  event_id: number | null;
  event_name: string;
  age_class: string | null;
  starts_at: string | null;
  min_officials: number;
  created_by: string;
}): Promise<void> {
  const { error } = await supabase
    .from("official_event_requirements")
    .upsert(values, { onConflict: "competition_id,round_id" });
  if (error) throw error;
}

/** Organizer writes a name by hand; a reusable official card is created. */
export async function createManualProfile(values: {
  full_name: string;
  email: string | null;
  phone: string | null;
  club: string | null;
  created_by: string;
}): Promise<OfficialProfile> {
  const { data, error } = await supabase
    .from("official_profiles")
    .insert({
      full_name: values.full_name,
      email: values.email ?? "",
      phone: values.phone,
      club: values.club,
      created_by: values.created_by,
      user_id: null,
    })
    .select(PROFILE_COLS)
    .single();
  if (error) throw error;
  return data as OfficialProfile;
}

/** Official signs up for an event themselves. */
export async function selfAssign(values: {
  competition_id: number;
  event_id: number | null;
  round_id: number;
  event_name: string;
  age_class: string | null;
  starts_at: string | null;
  day: string | null;
  profile_id: string;
  created_by: string;
}): Promise<void> {
  const { error } = await supabase.from("official_assignments").upsert(
    { ...values, source: "self", status: "confirmed" },
    { onConflict: "competition_id,round_id,profile_id" },
  );
  if (error) throw error;
}

export interface MyAssignment extends OfficialAssignment {
  competition_id: number;
  source: string;
}

export async function fetchMyAssignments(profileId: string): Promise<MyAssignment[]> {
  const { data, error } = await supabase
    .from("official_assignments")
    .select(`${ASSIGNMENT_COLS}, source`)
    .eq("profile_id", profileId)
    .order("starts_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as MyAssignment[];
}

/** Organizer marks every proposed assignment as requested. */
export async function requestConfirmations(competitionId: number): Promise<number> {
  const { data, error } = await supabase
    .from("official_assignments")
    .update({ status: "requested", requested_at: new Date().toISOString() })
    .eq("competition_id", competitionId)
    .eq("status", "proposed")
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}

/** Official confirms all of their own assignments for a competition. */
export async function confirmMyAssignments(
  profileId: string,
  competitionId: number,
): Promise<void> {
  const { error } = await supabase
    .from("official_assignments")
    .update({ status: "confirmed", responded_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("competition_id", competitionId)
    .neq("status", "declined");
  if (error) throw error;
}
