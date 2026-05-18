
# Maantie- ja maastojuoksut piiloon kaikkialta

## Tunnistus

Tietokannan rivien tarkistus näytti että nämä lajit esiintyvät kolmessa muodossa:

| Tapaus | event_category | sub_category | event_name |
|---|---|---|---|
| Selkeät | `Street` | `Run` | (mikä tahansa) — ~3 900 riviä |
| Väärin tagatut Track | `Track` | `Run` / `Walk` | sisältää "maantie" tai "maasto" |
| Väärin tagattu viesti | `Relay` | `Sprint` | "8x1km maastoviesti" |

Lisäksi live-API:n `SubCategory`-arvoissa esiintyvät `RoadRun` ja `CrossCountry` (joista koodin `translateSub` jo tietää).

## Yhteinen apufunktio

Uusi `src/lib/event-filters.ts`:

```ts
const ROAD_CROSS_RX = /maantie|maasto|cross[- ]?country|road\s*run/i;

export function isRoadOrCrossCountry(r: {
  event_category?: string | null;
  sub_category?: string | null;
  event_name?: string | null;
}): boolean {
  if ((r.event_category ?? "") === "Street") return true;
  const sub = r.sub_category ?? "";
  if (sub === "RoadRun" || sub === "CrossCountry") return true;
  return ROAD_CROSS_RX.test(r.event_name ?? "");
}

// Live-API Round-muoto
export function isRoadOrCrossCountryRound(r: {
  Category?: string;
  SubCategory?: string;
  EventName?: string;
  Name?: string;
}): boolean {
  return isRoadOrCrossCountry({
    event_category: r.Category,
    sub_category: r.SubCategory,
    event_name: r.EventName ?? r.Name,
  });
}
```

## Mihin sovelletaan

Strategia: **suodatus lukuhetkellä**. Harvesteri jatkaa kaiken keräämistä — vain UI ja tilastot piilottavat. Näin asetus voidaan myöhemmin perua yhdestä paikasta.

### Tilasto- ja koostelibit (Supabase-luvut)
Lisää `import` ja `.filter(r => !isRoadOrCrossCountry(r))` heti datan saannin jälkeen:
- `src/lib/today-stats.ts`
- `src/lib/daily-best.ts`
- `src/lib/club-today.ts`
- `src/lib/season-stats.ts`
- `src/lib/season-top.ts`
- `src/lib/season-leaders.ts` (sekä rivien suodatus että lajilistan koonti)
- `src/lib/fun-stats.ts`
- `src/lib/history-baseline.ts` (estää live-overlayn nostamasta maantietuloksia ennätyksiksi)
- `src/lib/athlete-history.ts`

### Urheilijaprofiili (käyttäjä valitsi A — kokonaan pois)
- `src/routes/athlete.$key.tsx`
- `src/routes/urheilija.$token.tsx`

Suodatetaan `athlete_results`-rivit ennen ryhmittelyä ja PB-listausta.

### Live-näkymät (Round / EventResults — Tuloslista-API)
- `src/routes/index.tsx` — päivän lajit -listan `runs`
- `src/routes/announcer.combined.tsx`, `announcer.live.tsx`, `announcer.planning.tsx` — eräluettelot
- `src/hooks/useAnnouncerData.ts` jos sieltä menee rounds-listan kautta
- `src/routes/running-ops.tsx` — juoksulajien operointi
- `src/routes/watch.tsx` — seurattujen tulokset
- `src/routes/round.$eventId.$roundId.tsx` — jos käyttäjä avaa suoran linkin: näytetään ystävällinen ilmoitus "Tämä laji on rajattu pois palvelusta" + paluu etusivulle

### Ei muuteta
- Harvesteri (`src/routes/api/public/hooks/harvest-results.ts`) — data säilyy
- `record_baseline` ja `athlete_results` -taulut — ei migraatioita, ei poistoja
- `src/routes/scoreboard.tsx` — vain kenttälajit
- Print-näkymät — käyttävät samoja libejä, suodatus periytyy automaattisesti

## Tekninen huomio

Yksittäisten libien sisällä haetut rivit on jo tyypitetty omilla interfaceilla joissa on `event_category`, `sub_category` ja `event_name` — `isRoadOrCrossCountry` toimii niihin suoraan. Live-puolella käytetään Round-varianttia. Ei tietokantamuutoksia.
