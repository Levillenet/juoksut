# Juoksulajien aika-asetusten yksinkertaistus

Käyttäjän palaute liitetyn YAG 2022 -aikataulun pohjalta: juoksulajeissa ei tarvita erillistä "eräväli"-asetusta. Riittää, että lajille annetaan **aika per erä** (sisältää järjestäytymisen). Solver kertoo sen erien lukumäärällä.

## 1. Tietomalli (plan_events)

Poistetaan käytöstä juoksuille:
- `between_heats_min` (ei enää käytössä juoksuilla)

Korvataan / käytetään olemassa olevaa kenttää:
- `minutes_per_heat` (numeric, nullable) — käyttäjän asettama oletus per laji
- Jos null → käytetään lajikatalogin oletusta (ks. kohta 3)

Aitojen pystytys/purku (`hurdles_setup_min`, `hurdles_teardown_min`) säilyy — koskee koko aitablokkia, ei yksittäistä erää.

Migraatio: ei pakollisia kolumnimuutoksia, mutta poistetaan UI:sta + solverista `between_heats_min`-käyttö juoksuissa. Voidaan jättää sarake tietokantaan (ei riko olemassa olevia rivejä).

## 2. Solver (`src/lib/planner-solver.ts`)

Juoksulajin kesto:
```
heats = ceil(participants / lanes)
duration = heats * minutes_per_heat
         + (is_hurdles ? setup + teardown : 0)
         + prep_before_start
```
Poistetaan `(heats - 1) * between_heats_min` -termi.

## 3. Oletusarvot per laji (Excel-pohjalta)

Lisätään `src/lib/planner-defaults.ts`:iin oletus `minutes_per_heat` per matka (ohjearvot YAG 2022 -aikataulusta):

| Matka | min/erä |
|---|---|
| 40 m / 60 m / 60 m aj | 4 |
| 80 m aj / 100 m / 100 m aj | 5 |
| 150 m | 5 |
| 300 m | 6 |
| 600 m / 800 m / 1000 m | 8 |
| 1000 m kävely | 10 |
| 3000 m kävely | 18 |

Demo-/template-generaattori esitäyttää nämä, käyttäjä voi muokata lajikohtaisesti.

## 4. UI (`planner.$planId.tsx` lajilista)

- Juoksulajin riville: yksi numerokenttä **"Aika/erä (min)"**.
- Piilotetaan/poistetaan "Erien väli (min)" -kenttä juoksulajeilta.
- Aitajuoksulle näkyvät lisäksi setup/teardown -kentät (kuten nyt).
- Kenttälajeilla (pituus, kuula, …) ei muutoksia.

## 5. Mitä EI tehdä

- Ei muuteta kenttälajien (hyppy/heitto) logiikkaa.
- Ei kosketa muiden juoksuasetusten (ratamäärä, valmistautumisaika ennen lajia) toimintaa.
- Ei tuoda Excel-tiedostoa sellaisenaan dataksi — käytetään vain ohjearvoina oletuksiin.

## Muutettavat tiedostot

- `src/lib/planner-types.ts` — kommentti `between_heats_min`-kentälle (legacy)
- `src/lib/planner-defaults.ts` — `MINUTES_PER_HEAT_DEFAULTS` map
- `src/lib/planner-solver.ts` — keston laskenta
- `src/lib/planner-demo.ts` — esitäyttö oletuksilla
- `src/routes/planner.$planId.tsx` — lajirivin UI
