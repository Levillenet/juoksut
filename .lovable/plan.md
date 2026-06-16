## Ongelma

Kun YAG-kopiossa generoidaan aikataulu, n. 75 lajia jää sijoittamatta ("ei mahdu mihinkään sallittuun päivään"). Syynä on, että **kaikki heittokehät ja kaikki keihäsvauhdinotot on niputettu yhteen implisiittiseen rajoiteryhmään**, jossa `max_concurrent = 1`. Tämä pakottaa neljä eri fyysistä heittoaluetta jakamaan yhden slotin.

## Korjaus 1 — Heittoalueiden eriyttäminen (pääongelma)

Laajennetaan `next_to_throw_cage`-merkintä koskemaan myös `throw_cage`-paikkoja, jotta erilliset heittoalueet voidaan erottaa.

**Solver (`src/lib/planner-solver.ts`, rivit 119–137):**
- Suodatetaan `cageIds` myös `next_to_throw_cage !== false` -ehdolla.
- Lisätään uusi "fyysinen alueistus": yksi implisiittinen ryhmä per "pääalue" (kaikki `next_to_throw_cage !== false` -paikat yhteen, kaikki muut eivät kuulu mihinkään implisiittiseen ryhmään).
- Vaihtoehtoinen, robustimpi malli (suositus): ryhmittele heittopaikat kentän `next_to_throw_cage`:n perusteella kahteen mahdolliseen "alueeseen":
  - `true` → "Pääalue (häkki)" — kaikki kuuluvat samaan ryhmään (max 1)
  - `false` → ei implisiittiseen ryhmään (oma alue)

**Stadion- ja plan-UI:**
- `src/routes/stadiums.$stadiumId.tsx`: näytä "Häkin vieressä / pääalueella" -checkbox myös `throw_cage`-paikoille (nykyisin vain `throw_runway`).
- `src/routes/planner.$planId.tsx`: vastaava checkbox plan_venues-listalla myös `throw_cage`-paikoille.

**Käyttäjälle:** jätä Kiekkokehä ja Keihäsvauhdinotto rastittuina (pääalue), poista rasti "Ulkoheittopaikka kiekko/moukari" ja "Keihäs ulkoheittopaikka" -paikoilta → ne operoivat itsenäisesti.

## Korjaus 2 — Diagnostiikan parannus (nopeuttaa jatkossa)

Vaihda `"ei mahdu mihinkään sallittuun päivään."` -viesti tarkemmaksi solverissa: kerro syy per yritetty päivä:
- "ei sopivia rinnakkaisia paikkoja (lukittu rajoiteryhmällä X)"
- "ei mahdu päivän aikaikkunaan (tarvitsee X min, vapaata Y min)"
- "päivärajoitus sulkee pois"

Tämä auttaa käyttäjää näkemään heti, johtuuko ongelma rajoiteryhmästä, paikoista vai ajasta — ilman koodimuutoksia datan korjaamiseksi.

## Korjaus 3 — Track-konflikti (Rata + Takasuora samaan aikaan)

Raporttisi näytti "Track-lukitus rikki" -kriittisiä konflikteja. Solver itse käyttää `ovalBusy`/`straightBusy`-lukitusta sijoittaessaan, joten konflikteja ei pitäisi syntyä uudessa generoinnissa. Tarkistetaan kuitenkin että `detectConflicts` käyttää samaa logiikkaa kuin solver, eikä eri raja-arvoja, jotka voivat valehdella konflikteista. Jos havaitaan ero, yhtenäistetään.

## Aikataulu

1. Solverin cage-suodatus ja UI-checkbox throw_cage:lle (Korjaus 1) — yksi commit, ratkaisee pääongelman.
2. Solverin syykohtainen "ei mahdu" -viesti (Korjaus 2) — vähäinen.
3. `detectConflicts`-tarkistus (Korjaus 3) — tutkimusvaihe, korjaus vain jos eroa löytyy.

## Mitä EI muuteta

- `allowed_days`-logiikkaa ei muuteta (ei ole ongelman lähde tässä kopiossa).
- `day_windows`-rakenne on tämän kopion datassa kunnossa (3 päivää).
- Olemassa olevia migraatioita ei tarvita — `next_to_throw_cage`-sarake on jo molemmissa tauluissa.
