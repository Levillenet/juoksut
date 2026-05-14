## Tausta — miten PB/SB tunnistetaan nyt

- **Lähde:** tuloslista.com API. Jokaisella urheilijalla tulee `PB`, `SB` ja `Result`. Mitään ei tallenneta meidän tietokantaan eikä snapshoteta kisan alussa.
- **Logiikka** (`detectRecord` tiedostossa `src/routes/announcer.tsx`):
  - Track-lajit: parannus jos `Result < PB` (tai `< SB`).
  - Field-lajit: parannus jos `Result > PB` (tai `> SB`).
  - Tyhjä PB/SB → ei merkintää (ei vahvistettavissa).
- **Parannuksen laskenta** on jo olemassa funktiossa `formatImprovement` ja sitä käytetään yläbannerissa, mutta ei tulosrivien tähden vieressä eikä muilla sivuilla.

## Mitä rakennetaan

Näytetään tähden vieressä parannus muodossa **`−0.18 s (PB 12.52)`** tai **`+0.15 m (SB 6.42)`** kaikkialla missä tulokset näkyvät.

### 1. Yhteinen apukirjasto

Siirretään `parsePerf`, `detectRecord`, `formatImprovement` ja `RecordStar` `announcer.tsx`:stä uuteen tiedostoon `src/lib/records.tsx`. Tähän lisätään uusi pieni komponentti:

```tsx
// Renderöi tähden + parannustekstin "−0.18 s (PB 12.52)"
<RecordBadge
  category="Track" | "Field"
  result={a.Result}
  pb={a.PB}
  sb={a.SB}
  size="lg" | "sm"
/>
```

`RecordBadge`:
- Kutsuu `detectRecord` → jos `null`, ei renderöi mitään.
- Renderöi `RecordStar` + viereen pienen tekstin: parannus + sulkuihin vertailtava arvo (PB tai SB jonka voitti).
- Teksti on muted/secondary-värisellä, tabular-nums, ettei riko layoutia.

### 2. Käyttöönotto sivuilla

Korvataan nykyiset `RecordStar`-käytöt ja vastaavat detect-kohdat:

- **`src/routes/announcer.tsx`** (rivit ~674 ja ~780, kortit + laajennettu lista): `RecordStar` → `RecordBadge`. Yläbanneri pidetään ennallaan (siellä on jo oma layout).
- **`src/routes/round.$eventId.$roundId.tsx`**: rivin oikeaan reunaan jossa nyt näytetään `SB`/`PB`/`#numero`. Jos `Result` on olemassa ja parannus löytyy → renderöi `RecordBadge` `Result`-arvon viereen. Tämä vaatii pienen muutoksen tulosrivin layoutiin (lisätään `Result`-kentän näyttö, jota ei nyt ole — se on tällä hetkellä enemmän lähtölista. Tarkistettava ennen toteutusta että API palauttaa `Result`-arvot myös tämän reitin kautta; jos kyllä, lisätään pieni "tulos"-sarake.)
- **`src/routes/watch.tsx`** (kilpailijaseuranta): jokaisen seuratun urheilijan tulosrivin viereen `RecordBadge`. Käytetään `category` joka on jo saatavilla erän/lajin tiedoissa.

### 3. Format

`formatImprovement` palauttaa jo oikean muodon (`−0.18 s` / `+0.15 m`). Lisätään `RecordBadge`:n sisällä sulkuihin vertailtava arvo:
- Jos `kind === "PB"` → `(PB 12.52)`
- Jos `kind === "SB"` → `(SB 12.52)`

Jos `formatImprovement` palauttaa `null` (esim. parsinta epäonnistui), näytetään pelkkä tähti ilman tekstiä.

## Mitä EI tehdä

- Ei snapshotata kisan alun PB/SB-arvoja omaan tietokantaan. Luotetaan API:n palauttamaan arvoon. (Jos myöhemmin halutaan ratkaista tilanne jossa API päivittää PB:n kesken kisan, se on erillinen iso muutos: vaatisi `competition_pb_snapshot`-taulun + cache-täytön kun kisa avataan ensimmäistä kertaa.)
- Ei muuteta `detectRecord`-logiikkaa.
- Ei lisätä uusia käännöksiä tai asetuksia.

## Tekninen huomio

- Uusi tiedosto on `.tsx`, koska `RecordStar`/`RecordBadge` ovat React-komponentteja. `parsePerf`/`detectRecord`/`formatImprovement` toimisivat myös `.ts`:ssä, mutta yhdellä tiedostolla on vähemmän importteja.
- `lucide-react`:n `Star` on jo asennettu.
- Watch-sivulla pitää varmistaa että `category` (Track/Field) on saatavilla per laji — jos ei, johdetaan se `EventCategory`-kentästä joka tulee `EventResults`:sta.
