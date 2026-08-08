import { supabase } from "@/integrations/supabase/client";

export interface VolunteerCall {
  id: string;
  competition_id: number;
  competition_name: string;
  competition_date: string | null;
  share_token: string;
  open_from: string | null;
  open_until: string | null;
  message: string | null;
}

export interface VolunteerTask {
  id: string;
  competition_id: number;
  name: string;
  description: string | null;
  day: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  needed_count: number;
  contact_name: string | null;
  contact_phone: string | null;
  sort_order: number;
}

export interface VolunteerSignup {
  id: string;
  task_id: string;
  competition_id: number;
  user_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  status: string;
  source: string;
}

/** Talkoohaun julkinen näkymä (tokenilla, ilman kirjautumista). */
export interface PublicVolunteerCall {
  competition_id: number;
  competition_name: string;
  competition_date: string | null;
  open_from: string | null;
  open_until: string | null;
  message: string | null;
  is_open: boolean;
}

export interface PublicVolunteerTask {
  id: string;
  name: string;
  description: string | null;
  day: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  needed_count: number;
  contact_name: string | null;
  contact_phone: string | null;
  sort_order: number;
  signed_count: number;
}

const CALL_COLS =
  "id, competition_id, competition_name, competition_date, share_token, open_from, open_until, message";
const TASK_COLS =
  "id, competition_id, name, description, day, start_time, end_time, location, needed_count, contact_name, contact_phone, sort_order";
const SIGNUP_COLS =
  "id, task_id, competition_id, user_id, full_name, phone, email, note, status, source";

/* ---------------- Järjestäjä ---------------- */

export async function fetchVolunteerCall(competitionId: number): Promise<VolunteerCall | null> {
  const { data, error } = await supabase
    .from("volunteer_calls")
    .select(CALL_COLS)
    .eq("competition_id", competitionId)
    .maybeSingle();
  if (error) throw error;
  return (data as VolunteerCall | null) ?? null;
}

export async function fetchOpenVolunteerCalls(): Promise<VolunteerCall[]> {
  const { data, error } = await supabase
    .from("volunteer_calls")
    .select(CALL_COLS)
    .order("competition_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as VolunteerCall[];
}

export async function openVolunteerCall(values: {
  competition_id: number;
  competition_name: string;
  competition_date: string | null;
  open_from: string | null;
  open_until: string | null;
  message: string | null;
  opened_by: string | null;
}): Promise<VolunteerCall> {
  const { data, error } = await supabase
    .from("volunteer_calls")
    .upsert(values, { onConflict: "competition_id" })
    .select(CALL_COLS)
    .single();
  if (error) throw error;
  return data as VolunteerCall;
}

export async function fetchVolunteerTasks(competitionId: number): Promise<VolunteerTask[]> {
  const { data, error } = await supabase
    .from("volunteer_tasks")
    .select(TASK_COLS)
    .eq("competition_id", competitionId)
    .order("day", { ascending: true, nullsFirst: false })
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as VolunteerTask[];
}

export async function createVolunteerTask(values: {
  competition_id: number;
  name: string;
  description: string | null;
  day: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  needed_count: number;
  contact_name: string | null;
  contact_phone: string | null;
  created_by: string | null;
}): Promise<VolunteerTask> {
  const { data, error } = await supabase
    .from("volunteer_tasks")
    .insert(values)
    .select(TASK_COLS)
    .single();
  if (error) throw error;
  return data as VolunteerTask;
}

export async function updateVolunteerTask(
  id: string,
  values: Partial<Omit<VolunteerTask, "id" | "competition_id">>,
): Promise<void> {
  const { error } = await supabase.from("volunteer_tasks").update(values).eq("id", id);
  if (error) throw error;
}

export async function deleteVolunteerTask(id: string): Promise<void> {
  const { error } = await supabase.from("volunteer_tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchVolunteerSignups(competitionId: number): Promise<VolunteerSignup[]> {
  const { data, error } = await supabase
    .from("volunteer_signups")
    .select(SIGNUP_COLS)
    .eq("competition_id", competitionId)
    .eq("status", "signed")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as VolunteerSignup[];
}

/** Järjestäjä lisää talkoolaisen käsin, ilman käyttäjätiliä. */
export async function addVolunteerManually(values: {
  task_id: string;
  competition_id: number;
  full_name: string;
  phone: string | null;
  note: string | null;
}): Promise<VolunteerSignup> {
  const { data, error } = await supabase
    .from("volunteer_signups")
    .insert({ ...values, status: "signed", source: "organizer" })
    .select(SIGNUP_COLS)
    .single();
  if (error) throw error;
  return data as VolunteerSignup;
}

export async function removeVolunteerSignup(id: string): Promise<void> {
  const { error } = await supabase.from("volunteer_signups").delete().eq("id", id);
  if (error) throw error;
}

/** Kirjautuneen omat talkoovuorot. */
export async function fetchMyVolunteerSignups(userId: string): Promise<VolunteerSignup[]> {
  const { data, error } = await supabase
    .from("volunteer_signups")
    .select(SIGNUP_COLS)
    .eq("user_id", userId)
    .eq("status", "signed")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VolunteerSignup[];
}

/* ---------------- Julkinen, tokenilla ---------------- */

export async function fetchPublicCall(token: string): Promise<PublicVolunteerCall | null> {
  const { data, error } = await supabase.rpc("get_volunteer_call", { _token: token });
  if (error) throw error;
  const rows = (data ?? []) as PublicVolunteerCall[];
  return rows[0] ?? null;
}

export async function fetchPublicTasks(token: string): Promise<PublicVolunteerTask[]> {
  const { data, error } = await supabase.rpc("list_volunteer_tasks", { _token: token });
  if (error) throw error;
  return ((data ?? []) as PublicVolunteerTask[]).map((t) => ({
    ...t,
    signed_count: Number(t.signed_count ?? 0),
  }));
}

export async function signUpForTask(values: {
  token: string;
  task_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  note: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("volunteer_signup", {
    _token: values.token,
    _task_id: values.task_id,
    _name: values.full_name,
    _phone: values.phone,
    _email: values.email,
    _note: values.note,
  });
  if (error) throw error;
  return data as string;
}

export function taskTimeLabel(task: {
  day: string | null;
  start_time: string | null;
  end_time: string | null;
}): string {
  const parts: string[] = [];
  if (task.day) parts.push(task.day);
  const t = (v: string | null) => (v ? v.slice(0, 5) : null);
  const s = t(task.start_time);
  const e = t(task.end_time);
  if (s && e) parts.push(`${s}–${e}`);
  else if (s) parts.push(`alkaen ${s}`);
  return parts.join(" · ") || "Ajankohta sovitaan";
}
