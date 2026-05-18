
# Etusivun yläosan selkeytys

Tällä hetkellä header (`src/routes/index.tsx`, rivit 302–383) niputtaa yhteen otsikon, kilpailuvalitsimen, päävalikon ja päiväkartat. Visuaalisesti ne sulautuvat yhdeksi möhkäleeksi koska kaikki ovat saman `border-b`-headerin sisällä ilman erottavia välejä tai kortteja.

## Tavoite

Kolme selkeästi erottuvaa lohkoa pinottuna:

```
┌─ Header (logo, kisan nimi, päivitä, kirjaudu ulos) ────────┐
└────────────────────────────────────────────────────────────┘

┌─ LOHKO 1: Kilpailun valinta (oma kortti) ──────────────────┐
│  Pieni otsikko: "Aktiivinen kilpailu"                      │
│  [CompetitionSwitcher  ▼]                                  │
└────────────────────────────────────────────────────────────┘

┌─ LOHKO 2: Päävalikko (oma kortti) ─────────────────────────┐
│  [ AVAA VALIKKO ▾ ]                                        │
│  (auki: NavCards-ruudukko)                                 │
└────────────────────────────────────────────────────────────┘

┌─ LOHKO 3: Päivän lajit (otsikko + päiväkartat) ────────────┐
│  "Päivän lajit" + [ti] [ke] [to] …                         │
└────────────────────────────────────────────────────────────┘
```

## Muutokset

Vain `src/routes/index.tsx`. Ei muutoksia muihin komponentteihin, ei logiikkamuutoksia.

### 1. Sticky-header kevyemmäksi
Headeriin jää vain logo, kisan nimi, päivitysaikaleima, kirjautuneen sähköposti sekä Päivitä- ja Kirjaudu-napit. Kilpailuvalitsin, AVAA VALIKKO -nappi ja päiväkartat **siirtyvät pois headerista** omiksi lohkoiksi pääsisällön yläosaan. Tämä myös vapauttaa pystytilaa kun käyttäjä rullaa.

### 2. Lohko 1 — Kilpailun valinta
Oma `section` `<main>`in alussa, omana korttina (`rounded-xl border bg-card p-4`). Sisältö:
- Pieni yläotsikko `"Aktiivinen kilpailu"` (`text-xs uppercase tracking-wider text-muted-foreground`)
- `CompetitionSwitcher` (sama komponentti, sama `confirmOnChange={isOfficial}`)
- Pieni apuvihje alle: "Vaihto vaikuttaa vain sinun näkymääsi"

Nykyinen voimakas oranssi "Valitse kilpailu live seurantaan tästä" -laatikko (rivit 346–350) korvautuu rauhallisemmalla otsikolla — kortin reunat tekevät jo selväksi että tämä on oma toimintonsa.

### 3. Lohko 2 — Päävalikko
Oma kortti heti kilpailuvalinnan alle. Sisältö:
- AVAA/PIILOTA VALIKKO -nappi (sama logiikka, sama localStorage-tila `NAVCARDS_COLLAPSED_KEY`)
- Auki: `NavCards` renderöidään kortin sisään
- Napin punainen ulkoasu vaihdetaan neutraalimpaan (primary-väri) jotta se ei näytä virhetilalta — punaisen voi varata vain destruktiivisille napeille

### 4. Lohko 3 — Päivän lajit
Säilyy nykyisellä paikalla mutta saa selkeän otsikon `<h2>Päivän lajit</h2>` ja sen viereen päiväkartat (rivit 366–382 siirtyvät headerista tähän). Vain `!isOfficial`-haarassa kuten nytkin.

### 5. Pieniä siivouksia
- Poistetaan headerista `text-lg PÄIVÄN LAJIT` -vesileima (rivit 323–325) — uusi `<h2>` lohkossa 3 hoitaa saman.
- `max-w-2xl`-leveys säilyy kaikissa lohkoissa, joten visuaalinen rytmi pysyy.

## Tekninen huomio

`navCollapsed`-tila ja sen `localStorage`-persistenssi siirtyvät loogisesti samaan paikkaan kuin uusi Lohko 2. `useRefreshIntervalSec`, `load()`, päiväkartat ja lajilista pysyvät täysin ennallaan. Ei muutoksia tyyppeihin, dataan eikä reititykseen.

## Mitä EI muuteta tässä

- NavCards-korttien sisältö, ikonit, värit, järjestys (eri tehtävä)
- TodayStats / DailyBest / ClubToday / SeasonStats -järjestys (eri tehtävä)
- Header-yläpalkin logo/kirjautumisnapit
- Mikään muu reitti
