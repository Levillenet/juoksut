## Ongelma

Kouvola Junior Games -kilpailussa vihreä varmistuspallo ei näy. Syy: tuloslistan API palauttaa `Confirmed`-tiedon vain `Enrollments`-listassa (per ilmoittautuminen), mutta `Rounds[].Heats[].Allocations[]`-riveissä `Confirmed` puuttuu kokonaan (tai on `null`). UI (`ConfirmedDot`, scoreboard, round-sivu, kuuluttajan näkymät) lukee `alloc.Confirmed`, joten pallo ei koskaan renderöidy.

Muissa kilpailuissa API täyttää `Confirmed`-kentän myös allokaatioihin, siksi bugi näkyy vain osassa kisoista.

## Korjaus

Rikastetaan allokaatiot yhdessä paikassa — `eventDetailsQueryOptions` tiedostossa `src/lib/tuloslista-queries.ts` — jotta kaikki näkymät (round-sivu, scoreboard, kuuluttaja) saavat automaattisesti oikean tiedon ilman komponenttimuutoksia.

### Muutos `eventDetailsQueryOptions`-funktioon

`fetchEvent`-kutsun jälkeen:

1. Rakennetaan haku `Enrollments`-listasta:
   - Ensisijainen avain: `TeamId` (löytyy sekä `Enrollment.TeamId`- että `Allocation.TeamId`-kentistä).
   - Vara-avain: `${Firstname}|${Surname}|${Organization.Id}` (kattaa tapaukset, joissa TeamId puuttuu).
   - Arvo: `Enrollment.Confirmed` (boolean).
2. Käydään läpi kaikki `ev.Rounds[].Heats[].Allocations[]` ja asetetaan `alloc.Confirmed`, jos se on tällä hetkellä `undefined` tai `null`, hakemalla arvo TeamId:llä tai nimellä.
3. Säilytetään API:n oma `Confirmed`, jos se on jo `true`/`false` (ei ylikirjoiteta muissa kisoissa).

### Tyyppipäivitys

`src/lib/tuloslista.ts`:
- Lisätään valinnainen `TeamId?: number | null` `Allocation`- ja `Enrollment`-tyyppeihin, jotta uusi haku käännetään ilman `any`-castia.

## Ei muutoksia

- `ConfirmedDot`, scoreboard, round-sivu, kuuluttajan komponentit — logiikka rikastetaan datalähteessä, joten UI toimii sellaisenaan.
- `competitionIndexQueryOptions` sisältää jo Enrollments-fallbackin (fromEnrollment-tila täyttää Confirmed-tiedon ilman muutoksia); jos halutaan sama varmuus myös indeksipohjaisiin näkymiin, sama rikastuslogiikka voidaan jakaa apufunktiona — jätetään tämän korjauksen ulkopuolelle, kunnes tarvetta ilmenee.

## Varmistus

Avataan Kouvola Junior Gamesin lajisivu preview:ssä ja tarkistetaan, että ilmoittautumislistassa varmistetuilla urheilijoilla näkyy vihreä piste.
