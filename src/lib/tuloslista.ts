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
  Result: string | null;
  ResultRank: number | null;
  HeatRank: number | null;
  Wind: number | null;
  Organization: { Name: string; NameShort: string; Id: number };
  Attempts?: { Line1: string | null }[];
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

const HELSINKI_TIME = new Intl.DateTimeFormat("fi-FI", {
  timeZone: "Europe/Helsinki",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatTime(iso: string): string {
  return HELSINKI_TIME.format(new Date(iso));
}

const HELSINKI_DATE_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Helsinki",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Returns the Helsinki-local "D.M.YYYY" key matching the schedule grouping. */
export function helsinkiDateKey(iso: string): string {
  const parts = HELSINKI_DATE_PARTS.formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${parseInt(d, 10)}.${parseInt(m, 10)}.${y}`;
}

export const STATUS_LABEL: Record<Round["Status"], string> = {
  Unallocated: "Eräjaot puuttuvat",
  Allocated: "Eräjaot tehty",
  Progress: "Käynnissä",
  Official: "Virallinen",
};

export function translateSub(sub: string): string {
  switch (sub) {
    case "Sprint": return "Pikajuoksu";
    case "Run": return "Juoksu";
    case "Hurdles": return "Aidat";
    case "Steeple": return "Estejuoksu";
    case "Relay": return "Viesti";
    case "Walk": return "Kävely";
    default: return sub;
  }
}

