import { supabase } from "@/integrations/supabase/client";

export interface OfficialProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  club: string | null;
  skills: string | null;
  notes: string | null;
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
}

export const STATUS_LABEL_FI: Record<AssignmentStatus, string> = {
  proposed: "Ehdotettu",
  requested: "Pyyntö lähetetty",
  confirmed: "Varmennettu",
  declined: "Kieltäytyi",
};

const PROFILE_COLS = "id, user_id, full_name, email, phone, club, skills, notes";
const CHILD_COLS =
  "id, profile_id, athlete_key, surname, firstname, organization, organization_id, is_guardian";
const CALL_COLS =
  "id, competition_id, competition_name, competition_date, open_until, message";
const ASSIGNMENT_COLS =
  "id, competition_id, event_id, round_id, event_name, age_class, starts_at, profile_id, role_label, status";

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
