## Juurisyy — kisa 19719 (Kouvola Junior Games, 4.7.)

`harvest_competitions`-taulussa 19719 on `done=true, exists_in_source=false, last_scanned_at=29.6.` Kisa ei ollut vielä tuloslista.com:ssa kesäkuun lopussa, mutta ID oli varattu. Harvestteri merkitsi sen "permanent gap" -logiikalla lopullisesti valmiiksi (`NONEXIST_PERMANENT_GAP=300`), koska se oli tuolloin >300 ID:tä uusimman havaitun takana. Kisa julkaistiin tuloslistalla myöhemmin, mutta harvestteri ei enää käy sitä läpi → tulokset eivät päädy `athlete_results`-tauluun eivätkä siten analytiikkaan.

## 1) Backend-korjaus (harvest-results.ts + migraatio)

**Logiikka** — `src/routes/api/public/hooks/harvest-results.ts`:
Ei merkitä ei-olemassaolevaa ID:tä koskaan lopullisesti valmiiksi pelkän ID-välin perusteella tuoreessa ikkunassa. Muutetaan `done`-päätös niin, että `exists_in_source=false` merkitään `done=true` vain jos ID on selvästi taakse jäänyt (`NONEXIST_PERMANENT_GAP`) JA sitä on jo probattu ainakin 30 päivää sitten ensimmäisen kerran. Käytännössä: säilytetään aiempi `last_scanned_at` päätöksessä — jos rivi on uusi (ei aiempaa `first_scanned_at`ia tai <30 pv) → `done=false` vaikka gap ylittyisi. Lisätään `harvest_competitions`-tauluun `first_scanned_at`-sarake (migraatio), joka asetetaan skannin ensimmäisellä havainnolla ja säilytetään upserteissa.

**Migraatio**:
- `ALTER TABLE harvest_competitions ADD COLUMN first_scanned_at timestamptz`.
- Backfill: `UPDATE ... SET first_scanned_at = last_scanned_at WHERE first_scanned_at IS NULL`.
- **Palauta jumissa olevat rivit revisit-tilaan** — kaikki ei-olemassaolevat kisat, joiden `first_scanned_at > now() - interval '30 days'` (mm. 19719): `UPDATE ... SET done=false`.

Seuraavassa pg_cron-ajossa harvestteri probaa 19719:n uudelleen, löytää tulokset ja upserttaa `athlete_results`-tauluun.

## 2) Analytiikkakäyrän visuaalinen viimeistely

Vain frontend-muutos `src/components/AthleteAnalytics.tsx`:
- Line: `type="natural"`, `strokeWidth={2.5}`, primary-väri, `strokeLinecap="round"`.
- Alueen (`<Area>`) täyttö lineaarisella gradientilla primary → transparent, opacity 0.25 → 0 pehmentää viivan taustaa.
- Piste-tyylit: pieni valkoinen rengas (`r=3`) primary-reunuksella; PB-piste iso täytetty (`r=6`); hover `activeDot r=7`. Kaikki edelleen klikattavia.
- Ruudukko vain vaakaviivat, `opacity 0.2`. Akselit ilman viivoja/tickejä, `axisLine opacity 0.3`.
- ReferenceLine PB:lle: `strokeDasharray="2 4"`, opacity 0.4.
- Marginit: `right: 16` jotta viimeinen piste ei leikkaannu.
- Aputeksti valintarivin alle: "Uusimmat kilpailut näkyvät parin tunnin viiveellä."

## Tiedostot

- migraatio (uusi): first_scanned_at + backfill + jumissa olevien reset.
- `src/routes/api/public/hooks/harvest-results.ts`: `done`-päättely huomioi `first_scanned_at`.
- `src/components/AthleteAnalytics.tsx`: viivan tyyli + area + aputeksti.

Ei kosketa muihin osiin (auth, jaot, muut näkymät).
