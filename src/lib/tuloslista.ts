// Tuloslista live API client. Public, CORS-open, no auth needed.
const API = "https://cached-public-api.tuloslista.com/live/v1";

export interface Round {
  Id: number;
  BeginDateTimeWithTZ: string;
  Category: "Track" | "Field" | string;
  SubCategory: string;
  EventId: number;
  EventName: string;
  Gender: string;
  Age: string;
  Name: string;
  Status: "Unallocated" | "Allocated" | "Progress" | "Official";
  GroupName: string;
  CountEnrolled: number;
  CountConfirmed: number;
  CountAllocated: number;
}

export type RoundsByDate = Record<string, Round[]>;

export interface Allocation {
  Id: number;
  AllocId: number;
  Position: number;
  Number: string | null;
  TeamName: string;
  Name: string;
  Firstname: string;
  Surname: string;
  NotInCompetition: boolean;
  PB: string;
  SB: string;
  Organization: { Name: string; NameShort: string; Id: number };
}

export interface Heat {
  Id: number;
  Index: number;
  Wind: number | null;
  Allocations: Allocation[];
}

export interface RoundDetailRound {
  Id: number;
  Name: string;
  BeginDateTimeWithTZ: string;
  Status: Round["Status"];
  EventId: number;
  Heats: Heat[];
}

export interface EventResults {
  Id: number;
  Name: string;
  Group: string;
  BeginDateTimeWithTZ: string;
  EventCategory: string;
  EventSubCategory: string;
  EventType: { Name: string; Length: number };
  EnrCount: number;
  Rounds: RoundDetailRound[];
}

export async function fetchRounds(competitionId: number): Promise<RoundsByDate> {
  const res = await fetch(`${API}/competition/${competitionId}`);
  if (!res.ok) throw new Error(`Eräjakojen haku epäonnistui (${res.status})`);
  return res.json();
}

export async function fetchEvent(competitionId: number, eventId: number): Promise<EventResults> {
  const res = await fetch(`${API}/results/${competitionId}/${eventId}`);
  if (!res.ok) throw new Error(`Lajin tietojen haku epäonnistui (${res.status})`);
  return res.json();
}

export interface CompetitionProperties {
  Competition: { Name: string; Id: number };
}
export async function fetchProperties(competitionId: number): Promise<CompetitionProperties> {
  const res = await fetch(`${API}/competition/${competitionId}/properties`);
  if (!res.ok) throw new Error(`Kisan tietojen haku epäonnistui (${res.status})`);
  return res.json();
}

/** Extract numeric competition id from URL or raw id input. */
export function parseCompetitionId(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/(\d{4,})/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

/** Filter only running events (Track category). */
export function isRunningEvent(r: Pick<Round, "Category">): boolean {
  return r.Category === "Track";
}

export function formatTime(iso: string): string {
  // The API returns timestamps already shifted to local (e.g. "2026-05-14T06:20:00.0000000+00:00"
  // really means 06:20 local). Use UTC parts to avoid double-shifting.
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export const STATUS_LABEL: Record<Round["Status"], string> = {
  Unallocated: "Eräjaot puuttuvat",
  Allocated: "Eräjaot tehty",
  Progress: "Käynnissä",
  Official: "Virallinen",
};
