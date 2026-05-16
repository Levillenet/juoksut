
## Hauskat tilastot — uusi sivu seuratuille urheilijoille

Uusi sivu `/hauskat-tilastot`, jossa kauden tilastot esitetään lapsille sopivalla, kannustavalla tavalla. Ideana ei ole paremmuusjärjestys vaan palkita monipuolisuus, ahkeruus ja mukana olo. Jokainen mittari tuottaa **oman top-listan**, joten useampi lapsi pärjää eri kategorioissa.

### Mistä data tulee

Kaikki olemassa olevasta `athlete_results`-taulusta seuratuille urheilijoille (sama lähde kuin nykyinen `SeasonStatsSection`). Ei uusia tauluja, ei taustaharavointia.

### Mittarit (kortteina, kullakin top 5 + oma sija)

1. **Lajien tutkimusmatkailija** — kauden aikana eri lajeja (event_name normalisoituna). Palkitsee kokeilemista.
2. **Ahkera kisaaja** — kisapäivien määrä kaudella.
3. **Suoritusten supersankari** — kaikkien suoritusten yhteismäärä (rivit `athlete_results`).
4. **Maratonjuoksija** — yhteensä juostut metrit kisoissa (parseTrackDistanceMeters jo olemassa).
5. **Kelloseppä** — juoksuissa käytetty kokonaisaika (summa Track-lajien result_numeric sekunneista).
6. **Hyppykirppu** — hyppylajien (Jump) suoritusten määrä.
7. **Heittotykki** — heittolajien (Throw) suoritusten määrä.
8. **Reissaaja** — eri kilpailupaikkojen / paikkakuntien määrä.
9. **Aikainen herääjä** — kauden ensimmäinen kisaaja (varhaisin kisapäivä).
10. **Pinnistäjä** — eniten suorituksia samana päivänä (paras kisapäivä).
11. **Uskollinen lajille** — eniten kertoja samassa lajissa kauden aikana.
12. **Stadionkävelijä** — arvioidut tunnit kentällä (estimateHoursAtVenue jo olemassa).

Ei sijoituslistoja (1./2./3.), ei ennätyksiä — niitä on jo muualla. Tämä sivu painottaa määrää ja monipuolisuutta, jotta jokaiselle löytyy oma vahvuus.

### Käyttöliittymä

- Yläosassa kausivalitsin (vuosi / kesä / talvi) — sama logiikka kuin `SeasonStatsSection`.
- Ikäluokkasuodatin valinnainen.
- Korttiruudukko (1 sarake mobiilissa, 2 desktopissa). Jokainen kortti:
  - Iso emoji/ikoni + leikkimielinen otsikko + lyhyt selitys
  - Top 3–5 nimellä ja arvolla, kärki korostettuna (esim. kultainen tausta)
  - Mukava sävy: "Hienoa Maijalle — 14 eri lajia!"
- Ei "voittajaa" koko sivulle, ei kokonaispisteytystä.

### Navigointi

- Lisätään linkki valikkoon (`NavCards`) etusivulla — uusi kortti "🎉 Hauskat tilastot".

### Tekniset palaset

- `src/lib/fun-stats.ts` — uusi aggregoija. Lukee samat rivit kuin `fetchSeasonStats`, mutta tuottaa `Record<metric, Array<{ athleteKey, name, value, valueLabel }>>`.
- `src/routes/hauskat-tilastot.tsx` — uusi sivu, `_authenticated`-tyylinen tarkistus (`useAuth` + redirect `/login`).
- `src/components/FunStatCard.tsx` — yhden mittarin kortti.
- Linkki etusivun `NavCards`-osioon.

Ei DB-migraatioita, ei uusia secretsejä, ei muutoksia harvestointiin.
