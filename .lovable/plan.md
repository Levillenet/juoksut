## Ongelma

Etusivun "Seuran urheilijat tänään" -lohkossa Siiri Aavikon T11 Korkeus 131 (YAG, tänään) ei näy uutena PB:nä, vaikka aiempi paras on 128 (Reilu Cup 2, 28.5.2026).

## Juurisyy

Tänään harvestoitu rivi tulee nimellä **`T11 Korkeus (E)`** (E = erä), mutta kaikki aiemmat rivit ovat **`T11 Korkeus`** ilman suluissa olevaa tarkennetta.

`ClubTodaySection` käyttää PB-vertailun avaimena `normalizeEventName(event_name)` joka tuodaan tiedostosta `src/lib/club-today.ts`. Sen toteutus tekee vain:
- pudottaa ikäluokkaprefiksin (`T11 `)
- pudottaa moniottelun prefiksin (`N-ottelu `)

Se ei pudota lopussa olevia sulkutarkennuksia, joten avaimet eivät täsmää:
- tänään: `Korkeus (E)`
- historia: `Korkeus`

→ `fetchClubPreviousPbs`-mappiin ei tule osumaa → `beatsPrev = false` → ei PB-merkkiä.

Tiedostossa `src/lib/athlete-history.ts` on jo robusti versio (samalla nimellä), joka pudottaa myös sulut, "R1+2"-aikataulut, "kilpailu N", "kierros N", "erä N" ja "Ryhmä N". Ongelma on, että `club-today.ts` käyttää omaa, vajaata kopiotaan.

## Korjaus

Korvataan `src/lib/club-today.ts`:n `normalizeEventName` re-exportilla `@/lib/athlete-history`:stä, jolloin kaikki kutsupaikat (`fetchClubPbs`-indeksointi ja `ClubTodaySection`:n lookup) käyttävät samaa normalisointia ja "T11 Korkeus (E)" matchaa historian "T11 Korkeus":iin.

```ts
// src/lib/club-today.ts
export { normalizeEventName } from "@/lib/athlete-history";
```

Ei muita muutoksia tarvita — `ClubTodaySection` importoi nimeä `@/lib/club-today`:sta ja PB-laskenta toimii heti.

## Vaikutus muihin urheilijoihin

Sama vika osuu kaikkiin tämän päivän kisojen lajinimiin, joissa on (E)/(A)/(B)/ryhmätunnus tai aikataulu — esim. YAG:ssa monet lajit ovat erissä. Tämä korjaa heidät samalla kertaa.

## Verifiointi

1. Avaa etusivu, valitse Siirin seura, päivä = tänään.
2. T11 Korkeus 131 saa PB-merkin ja parannustekstin "+3 cm (ed. PB 128)".
3. Tarkista muut YAG-laajeissa "(E)"-suffiksilla varustetut rivit — uudet PB:t merkitään odotetusti.
