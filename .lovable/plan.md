## YAG-kisan automaattinen aktivointi viikonlopuksi (12.–14.6.2026)

### Tavoite
Kun käyttäjä avaa palvelun YAG Espoo 2026 -viikonlopun aikana (pe–su 12.–14.6.2026), seurattavaksi kisaksi vaihtuu automaattisesti **YAG (id 19616)** — ilman että käyttäjän tarvitsee valita sitä itse kisavalitsimesta.

### Käyttäytyminen
- Automaattinen vaihto tehdään **kerran per käyttäjä per laite** (ja per rooli: käyttäjä/toimitsija).
  - Tämä tallennetaan localStorageen avaimella `tuloslista.yagAutoApplied.v1` (+ rooli) → jos käyttäjä vaihtaa myöhemmin pois YAG:sta viikonlopun aikana, valintaa kunnioitetaan eikä pakoteta takaisin.
- Vaihto tapahtuu vain ajanjaksolla **2026-06-12 00:00 – 2026-06-14 23:59 (Helsinki-aika)**.
- Vaihto käyttää nykyistä `useCompetitionId`-tilaa, joten tallennus menee sekä localStorageen että kirjautuneilla käyttäjillä user-metadataan normaalisti.
- Toimii sekä kirjautumattomille että kirjautuneille — ei vaadi backend-muutoksia.

### Tekninen toteutus
**Yksi muutos: `src/lib/competition-store.ts`**
- Lisätään vakio `YAG_AUTO = { id: 19616, start: "2026-06-12", end: "2026-06-14", flagKey: "tuloslista.yagAutoApplied.v1" }`.
- `useCompetitionId`-hookin sisälle lisätään `useEffect`, joka:
  1. Tarkistaa onko Helsingin nykyinen päivä YAG-välillä (käytä olemassa olevaa `helsinkiDateKey` / vastaavaa, tai vertaa ISO-päivä Helsinki-aikavyöhykkeellä).
  2. Lukee `localStorage[flagKey + role]`. Jos jo asetettu → ei tehdä mitään.
  3. Muuten kutsuu `update(19616)` (= sama polku kuin manuaalinen valinta, persistoi metadataan jos kirjautunut) ja kirjoittaa flagin.

### Mitä EI muuteta
- Ei kosketa muita komponentteja (CompetitionSwitcher, LiveCompetitionsSection, jne.) — ne lukevat samaa tilaa, joten näkymä päivittyy automaattisesti.
- Ei muutoksia tietokantaan, RLS:ään tai serverifunktioihin.
- Ei poisteta YAG_COMPETITION_ID-tai muita olemassa olevia YAG-vakioita.

### Käytön elinkaari viikonlopun jälkeen
- 15.6.2026 alkaen ehto ei enää täyty → koodi muuttuu no-opiksi. Voit poistaa logiikan myöhemmin halutessasi; flagit jäävät localStorageen harmittomina.