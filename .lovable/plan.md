## Tavoite

Käyttäjä näkee, milloin tausta-ajo on viimeksi päivittänyt tietokannan (eli kuinka tuoreita "Päivän parhaat", "Seuran tämän päivän tulokset", "Hauskat tilastot", "Kauden kärki" -näkymien tulokset ovat).

## Lähde

`harvest_state`-taulun rivissä `id = 'singleton'` on jo sarake `last_run_at`, jonka harvester päivittää jokaisen ajon päätteeksi. Sitä ei tarvitse muuttaa.

## Toteutus

### 1. Uusi apuri `src/lib/harvest-status.ts`

- Funktio `fetchHarvestStatus(): Promise<{ lastRunAt: string | null }>` joka tekee `supabase.from("harvest_state").select("last_run_at").eq("id","singleton").maybeSingle()`.
- Funktio `formatRelativeFi(date: Date, now: Date): string` joka palauttaa suomenkielisen suhteellisen ajan: "juuri nyt", "2 min sitten", "1 t sitten", "eilen klo 14:32", "16.5. klo 09:08".

### 2. Uusi komponentti `src/components/HarvestStatusBadge.tsx`

- Käyttää `useQuery`:a (`queryKey: ["harvest-status"]`, `staleTime: 30_000`, `refetchInterval: 60_000`).
- Renderöi pienen rivin: "Tietokanta päivitetty: 2 min sitten" + tooltip tarkalla aikaleimalla (lokaaliaika).
- Hover/aria-label: "Tausta-ajo hakee tuloksia live.tuloslista.com -palvelusta. Päivitetty viimeksi 16.5.2026 klo 14:08."
- Tyyli: `text-[11px] text-muted-foreground`, sopii nykyiseen tunnelmaan.

### 3. Sijoitus

Yksi näkyvä paikka kotinäkymässä riittää, koska sama tausta-ajo kattaa kaikki tausta-driven osiot:

- `src/routes/index.tsx` (rivi ~448–450): muokataan alalaidan attribuutiorivi muotoon:
  > "Lähde: live.tuloslista.com · Tietokanta päivitetty 2 min sitten"

  Tehdään korvaamalla nykyinen tekstirivi komponentilla, joka renderöi attribuution + `<HarvestStatusBadge />`.

Sama komponentti renderöidään myös:
- `src/routes/hauskat-tilastot.tsx` (sivun alalaidassa tai otsikon vieressä).
- `src/routes/season-leaders.tsx` (otsikon alla).

Näin käyttäjä saa palautteen tietokannan tuoreudesta riippumatta siitä, mistä näkymästä hän katsoo dataa.

## Rajaukset

- Ei muutoksia tietokannan rakenteeseen — `harvest_state.last_run_at` on jo olemassa.
- Ei muutoksia harvester-koodiin.
- Ei muutoksia muihin komponentteihin kuin yllä mainittuihin.
- Ei näytetä kursorin tilaa (next_id/latest_id) — käyttäjälle riittää aikaleima.

## Avoin valinta

Jos haluat, näytän aikaleiman vain kotinäkymässä, en muissa. Kerro jos haluat suppeamman tai laajemman sijoittelun.
