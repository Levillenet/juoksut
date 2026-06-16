## Tausta

Tiedosto: `src/routes/scoreboard.tsx` (komponentti `ScoreRow`, rivit ~683–960).

Käyttäjän havainnot live-näytössä (`/scoreboard?...&order=start` JA `&order=result`):

1. Urheilijan nimi näkyy kahteen kertaan rivillä.
2. Rank-laatikossa näkyy "0" joillakin urheilijoilla — ei merkitse mitään.

## Diagnoosi

### "0" rank-laatikossa
Rivillä 603–606 displayRank lasketaan:

```ts
order === "start"
  ? (row.Position ?? idx + 1)
  : (row.ResultRank ?? idx + 1)
```

Tuloslista-API palauttaa joillekin allokaatioille `Position = 0` (ei null), jolloin "0." renderöityy. Sama ongelma `ResultRank = 0` -tapauksessa kun tulosta ei vielä ole. `??` ei laukea koska arvo ei ole null/undefined.

Lisäksi suoritusjärjestyksessä mielekkäin numero ei ole järjestysluku (1., 2., 3.) vaan urheilijan **kilpailunumero** (`row.Number`, Tuloslista-kenttä `Allocation.Number: string | null`). Se on bib-numero joka näkyy urheilijan paidassa.

### Nimi 2x
`nameBlock` (rivit 714–769) renderöi nimen kerran tilassa stackName=false ja kahdelle riville (first / last) tilassa stackName=true. Koodissa ei ole näkyvää duplikaatiota, joten todennäköisin syy on että Tuloslista-API joissain tapauksissa palauttaa `Allocation.Name = "Etunimi Sukunimi Etunimi Sukunimi"` tai vastaava (esim. viestijoukkueen `Name` + `TeamName` yhdistettynä). Lisäksi koodissa on `Firstname` ja `Surname` erikseen — käytetään niitä kanonisena lähteenä ja jätetään `Name` käyttämättä.

## Muutokset

Kaikki muutokset tiedostoon `src/routes/scoreboard.tsx`.

### 1) Rank-laatikko → kilpailunumero suoritusjärjestyksessä, fallback siisti

`ScoreRow`-propseihin: vaihdetaan `displayRank: number` → tyyppi sallii myös merkkijonon (esim. "12") JA lisätään `displayMode: "rank" | "bib"`.

`ScoreboardLive` (rivit 600–615) -kutsupiste:

```tsx
<ScoreRow
  ...
  displayRank={
    order === "start"
      ? (row.Number?.trim() || (row.Position && row.Position > 0 ? String(row.Position) : "—"))
      : (row.ResultRank && row.ResultRank > 0 ? String(row.ResultRank) : "—")
  }
  displayMode={order === "start" ? "bib" : "rank"}
  ...
/>
```

`ScoreRow` rank-renderissä (rivi 790): kun `displayMode === "bib"` näytetään `#{displayRank}` ilman pistettä; muuten `{displayRank}.` (mutta jätetään piste pois jos arvo on "—").

### 2) Nimi vain kerran

`splitName(row.Name)` korvataan käyttämällä `Firstname` ja `Surname` -kenttiä suoraan:

```ts
const first = (row.Firstname ?? "").trim();
const last  = (row.Surname  ?? "").trim();
const fullName = [first, last].filter(Boolean).join(" ") || row.Name || row.TeamName || "";
```

`nameBlock`:
- stackName tapauksessa: rivi 1 = `first`, rivi 2 = `last` (kuten ennen, mutta luotettavasti API-kentistä).
- muutoin: `{fullName}` — yksi rivi, ei kaksinkerroin.

Tämä eliminoi sen riskin että API:n `Name`-kentässä on duplikoituna teksti.

### 3) Viestijoukkueet

Jos `Firstname`/`Surname` puuttuvat (viesti), näytetään `row.TeamName || row.Name` yhden rivin nimenä. Existing `formatRelayLegs(row)` jää näkymään alapuolelle.

## Tekninen tarkistus muutoksen jälkeen

- Visuaalinen verifiointi `browser--view_preview` -kutsulla `/scoreboard?...&order=start` ja `&order=result` URLeilla.
- Vahvistetaan että: (a) rank-laatikossa näkyy bib-numero suoritusjärjestyksessä eikä koskaan "0.", (b) nimi näkyy vain kerran molemmissa tiloissa.

## Mihin EI kosketa

- Solver-/kilpailutapahtuman generointilogiikkaan ei kosketa.
- Tuloksen, yritysten ja tuulilukeman renderöintiin ei muutoksia.
- Overlay (`NewResultOverlay`) jää ennalleen — siellä nimi tulee jo kerran (`a.Name`).
