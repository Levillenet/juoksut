// Tuloslista live API client.
//
// Selaimessa: kutsuu omaa välikerrosta /api/public/tuloslista/live/v1/...,
// joka cachettaa ja koalisoi pyynnöt Cloudflare Worker -reunalla
// (ks. src/lib/tuloslista-proxy.ts).
//
// SSR:ssä kutsutaan samaa proxy-reittiä absoluuttisella osoitteella, jotta
// palvelinrenderöinti ei ohita välimuistia eikä kasvata origin-kuormaa.
const PROXY_PATH = "/api/public/tuloslista/live/v1";
const PUBLIC_PROXY_ORIGIN = "https://tulokset.online";

function liveUrl(path: string): string {
  if (typeof window !== "undefined") {
    return `${PROXY_PATH}${path}`;
  }
  return `${PUBLIC_PROXY_ORIGIN}${PROXY_PATH}${path}`;
}

async function fetchLiveJson<T>(path: string, errorText: string): Promise<T> {
  const res = await fetch(liveUrl(path), { cache: "no-store" });
  if (!res.ok) throw new Error(`${errorText} (${res.status})`);
  return res.json();
}

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

export interface RelayAthlete {
  Id?: number;
  Index?: number;
  Firstname: string;
  Surname: string;
  Organization?: { Name: string; NameShort?: string; Id: number };
}

export interface AthleteOrder {
  Index?: number;
  Athlete?: RelayAthlete;
}

export interface Allocation {
  Id: number;
  AllocId: number;
  Position: number;
  Number: string | null;
  TeamName: string;
  TeamId?: number | null;
  Name: string;
  Firstname: string;
  Surname: string;
  NotInCompetition: boolean;
  Confirmed?: boolean | null;
  PB: string;
  SB: string;
  Result: string | null;
  ResultRank: number | null;
  HeatRank: number | null;
  Wind: number | null;
  Organization: { Name: string; NameShort: string; Id: number };
  Attempts?: { Line1: string | null; Line2?: string | null }[];
  AthleteOrders?: AthleteOrder[];
  Athletes?: RelayAthlete[];
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

export interface Enrollment {
  Id: number;
  Confirmed: boolean;
  NotInCompetition: boolean;
  Number: string | null;
  TeamId?: number | null;
  Name: string;
  Firstname: string;
  Surname: string;
  PB: string;
  SB: string;
  Organization: { Name: string; NameShort: string; Id: number };
  Athletes?: RelayAthlete[];
}


/** Format relay leg list: "1. Etu Suku · 2. ... · 3. ... · 4. ...".
 * Uses AthleteOrders first, falls back to Athletes. Returns null if no team
 * members are available. */
export function formatRelayLegs(
  alloc: Pick<Allocation, "AthleteOrders" | "Athletes">,
): string | null {
  const fromOrders = (alloc.AthleteOrders ?? [])
    .map((o) => ({
      idx: o.Index ?? o.Athlete?.Index ?? null,
      ath: o.Athlete,
    }))
    .filter((x): x is { idx: number; ath: RelayAthlete } => x.idx != null && !!x.ath);
  const source =
    fromOrders.length > 0
      ? fromOrders
      : (alloc.Athletes ?? [])
          .map((ath) => ({ idx: ath.Index ?? null, ath }))
          .filter((x): x is { idx: number; ath: RelayAthlete } => x.idx != null);
  // Vain todelliset viestit (vähintään 2 osuutta). Yksilölajeissa API saattaa
  // palauttaa yhden "osuuden" indeksillä 0, joka näkyisi rivinä "0. Etu Suku".
  if (source.length < 2) return null;
  return source
    .slice()
    .sort((a, b) => a.idx - b.idx)
    .map((x) => `${x.idx}. ${x.ath.Firstname} ${x.ath.Surname}`.trim())
    .join(" · ");
}

/** Same as formatRelayLegs but for a DB-stored leg list. */
export function formatRelayLegsFromRows(
  legs: { leg_index: number; firstname: string; surname: string }[],
): string | null {
  if (!legs || legs.length === 0) return null;
  return legs
    .slice()
    .sort((a, b) => a.leg_index - b.leg_index)
    .map((l) => `${l.leg_index}. ${l.firstname} ${l.surname}`.trim())
    .join(" · ");
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
  Enrollments?: Enrollment[];
}

export async function fetchRounds(competitionId: number): Promise<RoundsByDate> {
  return fetchLiveJson<RoundsByDate>(
    `/competition/${competitionId}`,
    "Eräjakojen haku epäonnistui",
  );
}

export async function fetchEvent(competitionId: number, eventId: number): Promise<EventResults> {
  return fetchLiveJson<EventResults>(
    `/results/${competitionId}/${eventId}`,
    "Lajin tietojen haku epäonnistui",
  );
}

export interface CompetitionProperties {
  Competition: { Name: string; Id: number };
}
export async function fetchProperties(competitionId: number): Promise<CompetitionProperties> {
  return fetchLiveJson<CompetitionProperties>(
    `/competition/${competitionId}/properties`,
    "Kisan tietojen haku epäonnistui",
  );
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

/** True when the round is a track heat round (alkuerä / välierä) rather than a final. */
export function isHeatRound(r: Pick<Round, "Category" | "Name">): boolean {
  if (r.Category !== "Track") return false;
  const x = (r.Name || "").toLowerCase().replace(/[äå]/g, "a").replace(/ö/g, "o");
  return /alkuer|valier/.test(x);
}


/** True for high jump and pole vault (data has one Attempts entry per height). */
export function isVerticalJump(
  ev: { EventSubCategory?: string | null } | { SubCategory?: string | null } | null | undefined,
): boolean {
  if (!ev) return false;
  const sub =
    (ev as { EventSubCategory?: string | null }).EventSubCategory ??
    (ev as { SubCategory?: string | null }).SubCategory ??
    "";
  return sub === "VerticalJump" || sub === "HighJump" || sub === "PoleVault";
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
    case "MiddleDistance": return "Keskimatkat";
    case "LongDistance": return "Pitkät matkat";
    case "Hurdles": return "Aidat";
    case "Steeple": return "Estejuoksu";
    case "Relay": return "Viesti";
    case "Walk": return "Kävely";
    case "Throw":
    case "Throws": return "Heitto";
    case "Jump":
    case "Jumps": return "Hyppy";
    case "HorizontalJump":
    case "Horizontal": return "Vaakahyppy";
    case "VerticalJump":
    case "Vertical": return "Pystyhyppy";
    case "HighJump": return "Korkeushyppy";
    case "PoleVault": return "Seiväshyppy";
    case "LongJump": return "Pituushyppy";
    case "TripleJump": return "Kolmiloikka";
    case "ShotPut": return "Kuulantyöntö";
    case "Discus": return "Kiekonheitto";
    case "Hammer": return "Moukarinheitto";
    case "Javelin": return "Keihäänheitto";
    case "Combined":
    case "Multi":
    case "MultiEvents": return "Moniottelu";
    case "RoadRun": return "Maantiejuoksu";
    case "CrossCountry": return "Maastojuoksu";
    default: return sub;
  }
}

