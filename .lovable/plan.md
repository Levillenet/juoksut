
## Ongelma

Urheilijaseurannassa (`/watch` ja `/seuraa/:token`) Stella Väli-Klemelän aiempi enn 60 m aidoissa näkyy **11,71**, vaikka DB:ssä paras tulos on jo **11,55** (Pika- ja aitajuoksukarnevaalit 25.6.2026). Tilastopuoli näyttää 11,55 oikein.

## Juurisyy

`effectiveRecord()` (src/lib/record-baseline.ts) hakee PB/SB:n prioriteetilla:

```
1. record_baseline (kaappaus kilpailun alussa)
2. alloc.PB      (tuloslistan live-API:n PB-kenttä)
3. historical    (oma DB, vain jos yllä on tyhjä)
```

Tuloslistan `alloc.PB` on tälle urheilijalle vanhentunut (11,71 – aika ennen 25.6.2026), eikä koskaan päivity karnevaaleilla tehdyllä 11,55:llä. Koska sääntö "1/2 wins" ei koskaan siirry historialliseen fallbackiin, DB:n oikea PB (11,55) jää käyttämättä.

Sivutuote samasta koodipolusta: aidat/heitot -tapauksessa historiallista fallbackia ei löydettäisi silloinkaan, koska `effectiveRecord`iin ei nyt välitetä `ageClass`-parametria — spec-sensitive `pbEventKey` etsii avaimella `"60m aidat|ac:"` (tyhjä) eikä matchaa tallennettuja `T11`-rivejä.

## Korjaus

Kaksi muutosta samaan tiedostoon:

### 1. `src/lib/record-baseline.ts` — vertaile lähteitä, älä tyydy ensimmäiseen

Muuta `effectiveRecord` niin että se
- lukee kaikki kolme lähdettä (baseline, alloc, historical)
- palauttaa **paremman** (juoksussa pienempi aika, kentällä suurempi tulos) sekä PB:hen että SB:hen
- käyttää `parsePerf()` -parseria vertailuun (sama mitä `records.tsx` käyttää — tuntee sekä "11,71", "11.71", "1.23,45", "4.42,40" -formaatit)

Kaappauslähteestä (`record_baseline`) tulee edelleen "vähintään" -pohja: sitä ei koskaan huononneta uudemmalla tuloslistan arvolla, mutta se voidaan yliajaa vain aidosti paremmalla historiadatalla. Jos parsimista ei onnistu, käytetään olemassa olevaa fallback-järjestystä.

### 2. Välitä `ageClass` kaikilta kutsupaikoilta

Jotta historial­linen fallback edes löytäisi aitatulokset, kutsupaikkojen pitää välittää ikäluokka. `Round.GroupName` on sama arvo minkä harvester tallentaa `age_class`-sarakkeeseen.

Muutokset kutsuissa:
- `src/routes/watch.tsx` (~rivi 781) → `ageClass: e.round.GroupName`
- `src/routes/seuraa.$token.tsx` (~rivi 269) → sama
- `src/hooks/useAnnouncerData.ts` (~rivi 238) → `ageClass: ev.GroupName`
- `src/routes/scoreboard.tsx` (~rivi 718) → `ageClass: <ev.GroupName vastaava>`
- `src/components/announcer/shared.tsx` (~rivit 384 ja 551) → `ageClass: round.GroupName`
- `src/components/announcer/NewResultOverlay.tsx` (~rivit 88 ja 209) → `ageClass: item.ageClass ?? round.GroupName` (lisää kenttä `item`iin tarvittaessa)
- `src/routes/round.$eventId.$roundId.tsx` (~rivit 386, 457) → `ageClass: data?.GroupName`

Lisää `history?.ageClass` -tyyppiin `record-baseline.ts`:n `effectiveRecord`-signatuurissa; se on jo tuettu vain sitä ei aiemmin käytetty tarkoituksellisesti.

## Varmistus

Ennen ja jälkeen korjauksen ajaa Playwrightilla `/watch`-sivun Stellan kortin auki live-kilpailussa, jossa aitajuoksu on tulossa, ja tarkastaa että aiempi PB näkyy 11,55. Ottelutulokset (11,71) pysyvät edelleen kelpo PB-ehdokkaina — niitä ei suodateta pois.

## Rajaus

Ei kosketa harvesteriin, tietokantaan, `pbEventKey`-avainrakenteeseen eikä ottelufiltteröintiin. Muutokset ovat frontend-luentalogiikassa.
