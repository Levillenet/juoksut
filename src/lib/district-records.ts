import { supabase } from "@/integrations/supabase/client";

export interface DistrictRecord {
  id: string;
  gender: "M" | "F";
  age_class: string;
  event_name_raw: string;
  event_pb_key: string;
  result_text: string;
  result_numeric: number | null;
  record_holder: string;
  birth_year: number | null;
  club: string;
  record_year: number | null;
  indoor: boolean;
  wind_or_manual: string | null;
}

export interface DistrictRecordBreak {
  id: string;
  athlete_key: string;
  athlete_result_id: string | null;
  age_class: string;
  event_pb_key: string;
  previous_result_numeric: number | null;
  previous_holder: string | null;
  previous_club: string | null;
  previous_year: number | null;
  new_result_numeric: number | null;
  new_holder: string;
  new_club: string;
  competition_id: number | null;
  competition_name: string | null;
  competition_date: string | null;
  broken_at: string;
}

export async function fetchDistrictRecords(): Promise<DistrictRecord[]> {
  const { data, error } = await supabase
    .from("district_records" as never)
    .select("*")
    .order("age_class")
    .order("event_name_raw");
  if (error) throw error;
  return (data ?? []) as DistrictRecord[];
}

export async function fetchRecentDistrictRecordBreaks(
  limit = 10,
): Promise<DistrictRecordBreak[]> {
  const { data, error } = await supabase
    .from("district_record_breaks" as never)
    .select("*")
    .order("competition_date", { ascending: false, nullsFirst: false })
    .order("broken_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DistrictRecordBreak[];
}

/** Age classes in the order used by the district records document. */
export const AGE_CLASSES: string[] = [
  "P8","P9","P10","P11","P12","P13","P14","P15","P16","P17","P19","P22",
  "T8","T9","T10","T11","T12","T13","T14","T15","T16","T17","T19","T22",
];
