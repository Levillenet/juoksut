## Ongelma

Urheilijakortin "Henkilökohtaiset ennätykset" -listassa näkyy kaksi ongelmaa:

1. **Roskaiset lajinimet eivät yhdisty puhtaaseen lajiin.** Esim. `T10 Pituus - R1+2 10:30, R3+4 n.11:05`, `T10 Pituus (ryhmä 2. klo 17.15)` ja `T10 Korkeus kilpailu 2` näkyvät omina PB-rivinä, eivätkä yhdisty `T10 Pituus` / `T10 Korkeus` kanssa, koska `normalizeEventName` strippaa vain ikäluokkaprefiksin — ei eräaikoja, "Ryhmä N"-, "kilpailu N"-, "- R1 ..."- tai sulkulisäyksiä.
2. **Alemman ikäluokan PB jää näkyviin, vaikka samassa lajissa on ylemmän ikäluokan tulos.** Nykyinen ryhmittely yhdistää eri ikäluokat normalisoidun nimen perusteella, mutta valitsee PB:ksi parhaan tuloksen ikäluokasta riippumatta — käyttäjä haluaa nähdä **ylemmän ikäluokan ennätyksen**, ja alemman ikäluokan vain jos ylemmästä ei ole tulosta.

## Toteutus

### 1. Vahvempi lajinimen normalisointi

`src/lib/athlete-history.ts` → `normalizeEventName`: ikäluokkaprefiksin strippauksen jälkeen siivotaan loppuosa seuraavin säännöin (samassa järjestyksessä):

- Leikkaa kaikki ` - R<numero>` -kohdasta alkaen loppuun (kattaa `- R1 18:00`, `- R1+2 10:30, R3+4 n.11:05`).
- Poista lopussa olevat sulkulausekkeet: ` \([^)]*\)$` (kattaa `(ryhmä 2. klo 17.15)`).
- Poista lopusta ` (?:kilpailu|kierros|erä)\s*\d+` (kattaa `kilpailu 2`).
- Poista lopusta ` Ryhmä\s*\d+` (kattaa `Ryhmä 1`).
- Trimmaa ylimääräiset välit lopuksi.

Tuloksena `T10 Pituus - R1+2 ...`, `T10 Pituus (ryhmä 2 ...)`, `T10 Pituus Ryhmä 1` → kaikki normalisoituvat muotoon `Pituus` ja yhdistyvät samaan ryhmään.

Käytetään sama normalisointi sekä ryhmittelyavaimena että `EventGroup.eventName`-näyttönimenä, jotta UI:ssa ei näy roskaista loppuosaa.

### 2. Ikäluokan priorisointi PB-valinnassa

Lisätään `src/lib/athlete-history.ts`:ään apuri `ageClassRank(age_class: string): number`:

- Aikuiset `M`/`N` (ilman numeroa) → korkein arvo (esim. 999).
- `M`/`N` + numero (veteraanit) → korkein arvo (999) — kohdellaan aikuissarjana PB-järjestyksessä; veteraaniluokat eivät syrjäytä aikuis-PB:tä, koska niiden tulokset ovat tyypillisesti aikuis-PB:tä huonompia, ja päinvastoin halutaan samaa kohtelua.
- `T`/`P` + numero → ikä numerona (esim. `T10` → 10, `T11` → 11).
- Tuntematon → 0.

`groupByEvent`:n PB-laskennassa (sekä kokonaisen `pb` että `pbIndoor`/`pbOutdoor`):

1. Selvitä ryhmän rivien korkein `ageClassRank`.
2. Suodata mukaan vain rivit, joiden rank on yhtä suuri kuin korkein.
3. Valitse näiden joukosta paras tulos `lowerBetter`-säännön mukaan.

Näin esim. jos urheilijalla on `T11 60m` -tulos, `T10 60m` -PB ei enää näy henkilökohtaisten ennätysten listassa. Lajikohtainen kehityshistoria (`group.rows`) säilytetään kokonaisuudessaan — vain PB-valinta priorisoidaan.

### 3. Pieni siisteys

`src/lib/athlete-history.ts`:n `normalizeEventName` on ainoa paikka, jossa nimi normalisoidaan UI:ta varten. SQL-puolen `public.normalize_event_name` (käytössä `mark_pbs_for_competitions`:ssa) jätetään ennalleen — tämä on backend-PB-merkinnän heuristiikkaa eikä vaikuta tämän bugin näkymään, ja sen muuttaminen vaatisi erillisen migraation + ajon.

## Mitä EI muuteta

- Tietokantarivejä tai harvest-logiikkaa ei muokata — alkuperäiset `event_name`-arvot säilytetään raakana, vain UI-puolen normalisointi tiukentuu.
- "Lajikohtainen kehitys" -listan rivejä ei piiloteta — kaikki historiarivit näkyvät edelleen.
- Jaettu urheilijakortti (`urheilija.$token.tsx`) ja oma kortti käyttävät samaa `groupByEvent`-funktiota, joten korjaus pätee molempiin automaattisesti.

## Tekniset tiedostot

- `src/lib/athlete-history.ts` — `normalizeEventName` laajennus + `ageClassRank` apuri + `groupByEvent`:n PB-valinta suodattaa korkeimman ikäluokan riveihin.
