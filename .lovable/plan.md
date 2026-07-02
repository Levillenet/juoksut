## Havaittu ongelma

Aavikko Siirin T11 Moukari 18.85 (kilpailu 19880, tänään) ei näytä PB:tä "Seuran urheilijat tänään" ‑listassa vaikka se on hänen ensimmäinen T11-ikäluokan (raskaampi väline) moukaritulos.

## Juurisyy

Tarkastin tietokannan: `was_pb = true` -merkintä puuttuu **jokaisesta** tuloksesta 12.6.2026 jälkeen. Tämä ei koske vain Aavikkoa vaan kaikkia urheilijoita ja kaikkia kilpailuja (19822, 19826, 19880, 19898, …). Yhteensä tuhansia tuloksia ilman PB-merkintää, vaikka joukossa on selkeitä ennätyksiä.

Tausta:
- `harvest-results.ts` kutsuu `mark_pbs_for_competitions(touchedCompIds)` jokaisen sadonkorjuun jälkeen.
- 14.6. julkaistiin uusi versio funktiosta (migration `20260614082813`), joka JOINaa kaikki urheilijan/lajin historian rivit. Tämä käytös on toiminnallisesti oikein, mutta epäilty aiheuttaa aikakatkaisun tai virheen isoilla `comp_ids`-syötteillä. Virhe menee vain `console.error`iin, joten oireet ovat hiljaisia.
- UI-logiikka `ClubTodaySection.tsx` päättää PB-badgen näyttämisen `r.was_pb || beatsPrev` -ehdolla. `beatsPrev` vaatii aiemman tuloksen samalla pb-avaimella; T11 Moukari on Aavikon ensimmäinen → ei löydy → PB ei näy.

## Suunnitelma

### 1. Backfill: merkitse puuttuvat PB:t (migraatio)

Ajetaan `mark_pbs_for_competitions` kaikille 12.6. jälkeen kosketetuille kilpailuille, pienissä erissä (esim. 20 kilpailua per kutsu), migraatiossa:

```sql
DO $$
DECLARE
  batch integer[];
  ids integer[];
BEGIN
  SELECT array_agg(DISTINCT competition_id)
    INTO ids
    FROM public.athlete_results
   WHERE competition_date >= '2026-06-12'
     AND competition_id IS NOT NULL;
  FOR i IN 1 .. array_length(ids,1) BY 20 LOOP
    batch := ids[i : LEAST(i+19, array_length(ids,1))];
    PERFORM public.mark_pbs_for_competitions(batch);
  END LOOP;
END $$;
```

### 2. Estä uusintaesiintymä: paloittele kutsut ja lokita virheet

Muokataan `src/routes/api/public/hooks/harvest-results.ts` (rivit ~483-489):
- Paloitellaan `touchedCompIds` erissä (esim. 25 per kutsu) `mark_pbs_for_competitions`iin, jotta yksikin iso ajo ei kaada koko markkausta.
- Vaihdetaan `console.error` → tarkempi loki (`mark_pbs error batch=N ids=…: msg`), jotta jatkossa nähdään heti kun taas hiljenee.

### 3. Verifiointi

- Ajon jälkeen tarkistetaan yhdellä SELECT-kyselyllä:
  - `Aavikko|Siiri|378` + `T11 Moukari` → `was_pb = true`.
  - `count(*) WHERE was_pb=true AND competition_date >= '2026-06-13'` on nollaa suurempi ja järjellinen (satoja/tuhansia).
- Preview: avataan seura Ahkera, päivä 2026-07-02, tarkistetaan että Siirin moukaririvissä on PB-merkki.

## Mitä EI muuteta

- UI-logiikkaa `ClubTodaySection.tsx` ei muuteta. Se toimii oikein niin kauan kuin `was_pb` on DB:ssä oikein. Ensimmäisen kerran ‑PB:t saadaan näkyviin backfillin kautta ilman että kliente joutuu arvaamaan.
- `event_pb_key` / `event_spec_suffix` -funktiot pysyvät ennallaan.

## Tekniset yksityiskohdat (dev)

Migraatiotiedosto: `supabase/migrations/<uusi_ts>_backfill_missing_pbs.sql`
Koodimuutos: `src/routes/api/public/hooks/harvest-results.ts` PB-marker-kohta
