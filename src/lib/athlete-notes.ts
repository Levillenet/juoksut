import { supabase } from "@/integrations/supabase/client";

export interface AthleteNote {
  id: string;
  user_id: string;
  athlete_key: string;
  competition_id: number;
  event_name: string;
  sub_category: string;
  note: string;
  updated_at: string;
}

export type NoteKey = string;

export function noteKey(
  competitionId: number,
  eventName: string,
  subCategory: string,
): NoteKey {
  return `${competitionId}|${eventName}|${subCategory ?? ""}`;
}

/**
 * Fetch all notes visible to the current user for one athlete (own + teammates').
 * Returns a map keyed by competition/event/sub → list of notes (one per author).
 */
export async function fetchNotesForAthlete(
  athleteKey: string,
): Promise<Map<NoteKey, AthleteNote[]>> {
  const { data, error } = await supabase
    .from("athlete_notes")
    .select("id, user_id, athlete_key, competition_id, event_name, sub_category, note, updated_at")
    .eq("athlete_key", athleteKey);
  if (error) throw error;
  const map = new Map<NoteKey, AthleteNote[]>();
  for (const n of data ?? []) {
    const k = noteKey(n.competition_id, n.event_name, n.sub_category ?? "");
    const list = map.get(k) ?? [];
    list.push(n as AthleteNote);
    map.set(k, list);
  }
  return map;
}

export async function upsertNote(params: {
  athleteKey: string;
  competitionId: number;
  eventName: string;
  subCategory: string;
  note: string;
}): Promise<AthleteNote | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Kirjaudu sisään tallentaaksesi muistiinpanoja.");

  if (!params.note.trim()) {
    // Delete instead of storing empty
    await supabase
      .from("athlete_notes")
      .delete()
      .eq("athlete_key", params.athleteKey)
      .eq("competition_id", params.competitionId)
      .eq("event_name", params.eventName)
      .eq("sub_category", params.subCategory ?? "");
    return null;
  }

  const { data, error } = await supabase
    .from("athlete_notes")
    .upsert(
      {
        user_id: userId,
        athlete_key: params.athleteKey,
        competition_id: params.competitionId,
        event_name: params.eventName,
        sub_category: params.subCategory ?? "",
        note: params.note.trim(),
      },
      { onConflict: "user_id,athlete_key,competition_id,event_name,sub_category" },
    )
    .select("id, athlete_key, competition_id, event_name, sub_category, note, updated_at")
    .single();
  if (error) throw error;
  return data as AthleteNote;
}

/** Suggest a contextual placeholder for the textarea. */
export function placeholderForEvent(eventName: string, category: string): string {
  const n = eventName.toLowerCase();
  if (n.includes("pituus") || n.includes("kolmiloikka")) {
    return "Esim. askelmerkki 18 askelta, ponnistus osui hyvin, vauhti riitti.";
  }
  if (n.includes("korkeus")) {
    return "Esim. vauhdinotto 9 askelta, alkukorkeus 1.40, ponnistuspaikka.";
  }
  if (n.includes("seiväs")) {
    return "Esim. seipään pituus, askelmerkki, otepituus.";
  }
  if (n.includes("keihäs") || n.includes("kuula") || n.includes("kiekko") || n.includes("moukari")) {
    return "Esim. heittovälineen paino, ote, tuntuma, vauhdin pituus.";
  }
  if (n.includes("aita")) {
    return "Esim. askelrytmi aitojen välissä, lähtö, aitakorkeus.";
  }
  if (category === "Track" || /\d+\s*m/.test(n)) {
    return "Esim. lähtö, välivauhdit, taktiikka, sääolot.";
  }
  return "Lisää muistiinpanoja: olosuhteet, tuntuma, tavoite, kehityskohta…";
}
