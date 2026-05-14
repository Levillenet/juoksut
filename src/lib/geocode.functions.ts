import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function nominatimSearch(query: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "fi");
  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "tuloslista-seuranta/1.0 (contact: lovable.app)",
      "Accept-Language": "fi",
    },
  });
  if (!res.ok) {
    console.warn(`[nominatim] HTTP ${res.status} for ${query}`);
    return null;
  }
  const json = (await res.json()) as NominatimResult[];
  if (!json.length) return null;
  const first = json[0];
  return {
    lat: parseFloat(first.lat),
    lng: parseFloat(first.lon),
    displayName: first.display_name,
  };
}

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        query: z.string().min(2).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const result = await nominatimSearch(data.query);
    return { result };
  });
