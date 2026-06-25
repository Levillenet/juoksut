## Tavoite

Pieni vihreä piste/badge varmistuksen tehneen kilpailijan kohdalle kaikissa osallistujaluetteloissa ennen suoritusta. Ei merkkiä varmistamattomille. Varmistustieto piilotetaan kun suoritus on jo tehty.

## Datakerros

`src/lib/tuloslista.ts`:
- Lisätään `Allocation`-interfaceen `Confirmed?: boolean` (valinnainen, API saattaa palauttaa sen myös erä­allokaatioille). `Enrollment.Confirmed` on jo olemassa.

## Pieni jaettu komponentti

`src/components/ConfirmedDot.tsx` (uusi):
- Renderöi pienen vihreän pisteen (esim. 8 px) tooltipillä "Osallistuminen varmistettu".
- Palauttaa `null` kun `confirmed !== true`.
- Käytetään yhtenäisesti kaikissa listoissa.

## Sijoittelu listoissa (näkyy vain ennen suoritusta = `!a.Result`)

1. **`src/routes/round.$eventId.$roundId.tsx`**
   - Ilmoittautumislista: piste nimen oikealle puolelle (samaan riviin nimen ja "ei lisenssiä?" -badgen kanssa).
   - Erälistaus (kun heats on): piste nimen viereen rivillä, jossa `!a.Result`.

2. **`src/components/announcer/shared.tsx`**
   - `AllocationRow` (rivi ~424): piste nimen `<span>`:n viereen kun `!a.Result`.
   - Pääosallistujarivit (rivit ~310): piste nimen jälkeen kun `!a.Result`.

3. **`src/routes/scoreboard.tsx`**
   - Kun rivillä ei ole vielä tulosta, piste nimen viereen.

Muissa luetteloissa (printit, club-raportit, harvest, hooks) ei näytetä — ne ovat kilpailun jälkeisiä tai analyysejä.

## Tyyli

- Vihreä piste käyttäen design-tokenia (esim. `bg-emerald-500` tai semanttinen success-väri jos olemassa — tarkistetaan `src/styles.css`). Jos ei semanttista tokenia, lisätään `--success`-token tai käytetään suoraan `bg-green-500`/`emerald-500` tämän pisteen kohdalla.
- Saavutettavuus: `aria-label="Osallistuminen varmistettu"`, `title` sama.

## Ei muutoksia

- Solveri, suunnitelmat, tietokanta, harvest, käännös­funktiot — ei kosketa.
- Varmistamattomille ei lisätä mitään.
