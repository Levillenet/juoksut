## Ongelma

Tobias jäi finaalissa DNS, vaikka juoksi alkuerässä 10,87. Nykyinen harvesteri (Track: "viimeisin kierros voittaa") tallentaa pelkän DNS:n eikä alkuerän aikaa, joten etusivun "Seuran urheilijat tänään" -listassa näkyy vain DNS.

## Tavoite

Track-lajeissa näytetään kisan **paras aika** ja **missä erässä** se juostiin (Alkuerä, Välierä, A-finaali, B-finaali, Loppukilpailu…). Erä-merkintä näytetään aina kun se on muu kuin loppukilpailu/finaali — eli aina kun "virallinen" lopputulos ei ole tämä rivi.

Tobiaksen tapaus: pää-tulokseksi tulee `10,87` ja sen alle pieni teksti `Alkuerät`.

## Ratkaisu

### 1. Tietokanta (migraatio)

Lisätään `athlete_results`-tauluun yksi sarake:

```sql
ALTER TABLE public.athlete_results
  ADD COLUMN result_round_name text NOT NULL DEFAULT '';
```

- `''` = sama kuin "loppukilpailu" → ei näytetä erikseen
- Muu arvo (`Alkuerät`, `A-finaali`, `B-finaali`, `Välierä`, …) → näytetään tulosrivin alla

Ei uusia GRANTeja tarvita (sarake olemassa olevaan tauluun).

### 2. Harvesteri (`src/routes/api/public/hooks/harvest-results.ts`)

Track-haaran nykyinen "myöhin kierros voittaa" -looppi vaihdetaan seuraavaan:

1. Käydään kaikki kierrokset & erät läpi, kerätään urheilijakohtaisesti **paras numeerinen aika**. Talletetaan sen kierroksen `round.Name`.
2. Jos urheilijalla ei ole yhtään numeerista tulosta koko lajissa → pidetään nykyinen logiikka (viimeisin kierros voittaa, esim. DNS), `result_round_name = ''`.
3. `result_round_name` täytetään vain jos kierros on **muu kuin viimeisin** (eli paras aika EI tullut finaalista/loppukilpailusta). Muuten jätetään tyhjäksi.
4. `result_rank` otetaan siltä kierrokselta, jolta valittu tulos on (alkuerässä = `HeatRank`/`ResultRank` heatin sisällä; käytetään `ResultRank`-arvoa joka API:ssa on jo asetettu).

Field/Throw/Combined: ei muutoksia.

Vanhat rivit täydentyvät kun harvesteri revisitoi kisan (tuoreet kisat revisitoidaan automaattisesti tuoreusikkunassa).

### 3. Luku- ja näyttökerros

**`src/lib/club-today.ts`**
- Lisätään `result_round_name` `ClubTodayRow`-tyyppiin ja `fetchClubTodayResults`-selectin sarakkeisiin.

**`src/components/ClubTodaySection.tsx`**
- Tulosrivin yhteyteen pieni vihje, kun `r.result_round_name` ei ole tyhjä — esim. lisätään meta-rivin loppuun `· ${r.result_round_name}` (samalla tyylillä kuin `· sija 5 · PB 10,77`). Näin Tobiaksella näkyy:
  `M 100m · M · sija 5 · PB 10,77 · Alkuerät` ja päätulokseksi `10,87`.

Mitään muuta näkymää (tulosteet, athlete-sivu, jaetut linkit) ei muuteta tällä kierroksella.

### 4. Mitä EI muuteta

- `was_pb`-laskenta (`mark_pbs_for_competitions`): toimii edelleen `result_numeric`-arvon perusteella, joten nyt myös alkuerän PB tunnistetaan oikein.
- RLS-policyt, GRANTit, muut taulut.
- Print-näkymät ja athlete-historiakomponentit.

## Tiedostot

- Migraatio: yksi uusi sarake `athlete_results`
- `src/routes/api/public/hooks/harvest-results.ts` — Track-haaran logiikka
- `src/lib/club-today.ts` — tyyppi + select
- `src/components/ClubTodaySection.tsx` — erä-merkintä meta-riville
