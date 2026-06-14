
# VAIHE 3 — Sääntöpohjainen kestoarvio (YAG 2022 -kaavat)

Tavoite: `planner-estimate.ts` käyttää sääntöjä, ei `event_duration_stats`-mediaaneja eikä `athlete_results`-regressiota. Taulu jää diagnostiikkaan.

## A) Migraatio: `plan_events`

Lisää sarakkeet:
- `station_count integer NOT NULL DEFAULT 1` — *jo olemassa* (tarkistetaan; jos on, skipataan)
- `heat_size integer NOT NULL DEFAULT 8` — osallistujia per erä juoksuissa

(planner-types.ts:n `PlanEventRow` päivitetään vastaamaan.)

## B) `src/lib/planner-rules.ts` (uusi)

Pieni, puhdas moduuli joka sisältää kaavat ja palauttaa `{ minutes, formula }`:

- **Juoksu**: tunnista matka/aidat `event_name`-stringistä → lookup `min_per_heat`-taulukosta. `lanes = matka ≥ 1000m ? 16 : heat_size (oletus 8)`. `heats = ceil(participants/lanes)`. `minutes = heats × min_per_heat`. Formula: `"75 osall. / 8 lanea = 10 erää × 4 min = 40 min"`.
- **Pituus/3-loikka**: `participants × 1.2 / station_count + 15`. Formula näyttää jakaja+valmistelu.
- **Korkeus**: `clamp(60 + max(0, n-10) × 2, 45, 150)`.
- **Seiväs**: `clamp(75 + max(0, n-8) × 4, 60, 180)`.
- **Kuula/kiekko/moukari**: `clamp(25 + n × 1.5, 30, 90)`.
- **Keihäs**: `clamp(30 + n × 1.7, 35, 100)`.

Lajityypin tunnistus jaetaan `planner-timings.ts`:n nykyisten `isHurdleEvent` / `isJumpPitEvent` / `isVerticalEvent` / `isTrackEvent` -funktioiden kanssa + heittolajeille uusi `throwKind(name) -> 'shot'|'discus'|'hammer'|'javelin'|null`.

## C) `planner-estimate.ts` uusiksi

Korvataan nykyinen regressio/override/rule-yhdistelmä:

1. **Override** (`event_duration_overrides` tai `override_duration_min` rivillä) → käytä sitä, `source = "override"`.
2. Muuten kutsu `computeRuleEstimate(input)` → `source = "rule"`.
3. **EI** enää `loadHistory`/`linearRegression`-kutsuja, EI `event_duration_stats`-lukua.
4. Palautteen `detail`-kenttä = ihmisluettava kaava (esim. `"75 / 8 = 10 erää × 4 min"`). `sampleSize = 0`.
5. Juoksun A/B-finaalilogiikka säilytetään ennallaan.

## D) UI: kestoarvio tooltipissa

Plannerin Lajit-välilehti (tiedosto: etsitään `planner.$planId.tsx`:stä):
- Rivillä näytetään `estimateMinutes` min + pieni info-ikoni.
- Tooltip = `detail`-kenttä (kaava).
- Lisätään number-input `heat_size` (juoksuille) — `station_count` on jo UI:ssa heittopaikoille/hyppypaikoille.

## E) Mitä EI muuteta

- `event_duration_stats`-taulu ja `compute-duration-stats`-funktio jäävät (diagnostiikka).
- `event_duration_overrides` säilyy ja voittaa edelleen kaavan.
- `planner-timings.ts` säilyy (per-heat-aika tulee silti `defaultMinutesPerHeat`-funktiosta, joka päivitetään käyttämään samaa lookup-taulukkoa kuin uusi `planner-rules.ts` — yksi totuus).

## Implementointijärjestys

1. Migraatio: `heat_size`-sarake `plan_events`:iin (tarkista `station_count`).
2. `src/lib/planner-rules.ts` + `planner-types.ts`-päivitys.
3. Refaktoroi `planner-estimate.ts` (poista `loadHistory`, `linearRegression`).
4. UI: `heat_size`-kenttä + tooltip Lajit-välilehdellä.
5. Yhtenäistä `planner-defaults.ts:defaultMinutesPerHeat` käyttämään samaa taulukkoa.

## Avoimet kysymykset

- **Kävely (3000m kävely jne.)**: kaavasi ei mainitse niitä. Säilytetäänkö nykyiset arvot (`planner-defaults.ts` rivit 126–127: 10/18 min/erä) heat-pohjaisessa laskennassa? Oletan **kyllä** — listataan samaan lookup-taulukkoon.
- **1500m**: kaavasi sanoo "1000m, 1500m: 4 min / 16 osall.". Vahvistus: 4 min/erä myös 1500m:lle?
- **Aidat 60m vs 80/100m**: kaava antaa molemmille 6 min — sovelletaan myös lyhyempiin ikäluokkien aitamatkoihin (esim. 50m aidat T11)?
