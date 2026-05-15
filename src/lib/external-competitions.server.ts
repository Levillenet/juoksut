// Scraper for kilpailukalenteri.fi (Finnish athletics competition calendar).
// The site exposes no public API; we scrape the month-browse view (cs=15).

import * as cheerio from "cheerio";

const BASE = "https://www.kilpailukalenteri.fi";

export interface ScrapedCompetition {
  source_id: number;
  name: string;
  location: string;
  classification: string;
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  registration_deadline: string;
  url: string;
  raw: Record<string, unknown>;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Parse rows like "ti 05.05.", "pe-la 15.-16.05.", "la-su 23.-24.05." into start/end ISO dates. */
function parseDateRange(
  text: string,
  defaultYear: number,
): { start: string; end: string | null } | null {
  const cleaned = text.replace(/\s+/g, " ").trim();
  // pe-la 15.-16.05. → days 15 and 16, month 05
  const range = cleaned.match(/(\d{1,2})\.-(\d{1,2})\.(\d{1,2})\.(?:(\d{2,4}))?/);
  if (range) {
    const d1 = +range[1];
    const d2 = +range[2];
    const m = +range[3];
    const y = range[4] ? (range[4].length === 2 ? 2000 + +range[4] : +range[4]) : defaultYear;
    return { start: toIso(y, m, d1), end: toIso(y, m, d2) };
  }
  // la 09.05. or la 09.05.2026
  const single = cleaned.match(/(\d{1,2})\.(\d{1,2})\.(?:(\d{2,4}))?/);
  if (single) {
    const d = +single[1];
    const m = +single[2];
    const y = single[3] ? (single[3].length === 2 ? 2000 + +single[3] : +single[3]) : defaultYear;
    return { start: toIso(y, m, d), end: null };
  }
  return null;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "juoksut-bot/1.0 (+https://juoksut.lovable.app)",
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return res.text();
}

/** Scrape a single month browse page. Returns competitions found in that month's listing. */
async function scrapeMonth(year: number, month: number): Promise<ScrapedCompetition[]> {
  const ndate = `${year}${pad(month)}01`;
  const url = `${BASE}/?cs=15&ndate=${ndate}&sdate=m`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const results: ScrapedCompetition[] = [];
  const seen = new Set<number>();

  // The competition listing rows contain an anchor with href "?cs=16&nid=..."
  $("a[href*='cs=16&nid=']").each((_, a) => {
    const $a = $(a);
    const href = $a.attr("href") ?? "";
    const nidMatch = href.match(/nid=(\d+)/);
    if (!nidMatch) return;
    const sourceId = +nidMatch[1];
    if (seen.has(sourceId)) return;

    const $row = $a.closest("tr");
    if ($row.length === 0) return;
    const cells = $row.find("td").toArray().map((td) => $(td).text().replace(/\s+/g, " ").trim());
    if (cells.length < 4) return;

    // Expected order: [date, classification, name, location, deadline, WA-rating]
    const dateText = cells[0];
    const classification = cells[1];
    const name = $a.text().replace(/\s+/g, " ").trim();
    const location = cells[3] ?? "";
    const deadline = (cells[4] ?? "").replace(/^[-–]$/, "");

    const range = parseDateRange(dateText, year);
    if (!range) return;

    seen.add(sourceId);
    results.push({
      source_id: sourceId,
      name,
      location,
      classification,
      start_date: range.start,
      end_date: range.end,
      registration_deadline: deadline,
      url: `${BASE}/?cs=16&nid=${sourceId}`,
      raw: { dateText, cells },
    });
  });

  return results;
}

/**
 * Scrape `monthsAhead` months starting from the current month.
 * Deduplicates by source_id (a multi-day event in two months collapses to one row).
 */
export async function scrapeKilpailukalenteri(monthsAhead = 6): Promise<ScrapedCompetition[]> {
  const now = new Date();
  const startYear = now.getFullYear();
  const startMonth = now.getMonth() + 1;
  const all = new Map<number, ScrapedCompetition>();
  for (let i = 0; i < monthsAhead; i++) {
    const m0 = startMonth - 1 + i;
    const year = startYear + Math.floor(m0 / 12);
    const month = (m0 % 12) + 1;
    try {
      const rows = await scrapeMonth(year, month);
      for (const r of rows) {
        // Keep the earliest occurrence (matches start_date best)
        const existing = all.get(r.source_id);
        if (!existing || r.start_date < existing.start_date) all.set(r.source_id, r);
      }
    } catch (e) {
      console.error("scrapeMonth failed", year, month, e);
    }
  }
  return Array.from(all.values());
}
