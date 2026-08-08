# Kisojen järjestelyoikeus omaksi rooliksi

Tällä hetkellä käyttäjäoikeuksissa voi valita vain admin, planner ja toimitsija. Toimitsija-rooli avaa nyt samalla sekä toimitsijana toimimisen että kaikki järjestelyoikeudet: haun avaamisen, toimitsijoiden hallinnan sekä pääsyn toimitsijoiden yhteystietoihin ja urheilijasidonnaisuuksiin. Nämä pitää erottaa toisistaan.

## Mitä rakennetaan

Uusi oikeustaso "kisajärjestäjä" (järjestelyoikeudet):

- Voi avata ja hallita toimitsijahakuja ja talkoohakuja, luoda tehtäviä, kiinnittää toimitsijoita ja lajijohtajia sekä lähettää varmennuspyynnöt.
- Näkee toimitsijoiden ja talkoolaisten yhteystiedot (sähköposti, puhelin, seura) sekä toimitsijoiden asettamat urheilijasidonnaisuudet (omat lapset).
- Tavallinen käyttäjä ja tavallinen toimitsija näkevät vain nimen, ei yhteystietoja eikä sidonnaisuuksia. Toimitsija näkee edelleen omat tietonsa, oman profiilinsa, omat lapsensa ja oman aikataulunsa.
- Admin saa aina samat oikeudet kuin kisajärjestäjä.

Sami Aavikon tunnukselle (samiaavikko@gmail.com) lisätään uusi rooli. Tunnuksella on jo admin-oikeudet, joten järjestelyoikeus tulee sen rinnalle näkyvästi valittuna.

## Tekninen toteutus

1. **Tietokanta**
   - Lisätään `organizer` arvoksi `app_role`-enumiin.
   - Päivitetään käyttöoikeussäännöt niin, että toimitsijoiden profiilien, lasten (urheilijasidonnaisuuksien), kiinnitysten, hakujen, talkootehtävien ja talkooilmoittautumisten hallinta ja luku vaativat jatkossa `admin` tai `organizer` -roolin nykyisen `official`-roolin sijaan. Toimitsijan omat rivit (`auth.uid()`) säilyvät ennallaan.
   - Lisätään `organizer`-rooli samaiselle sähköpostille.

2. **Sovelluslogiikka**
   - `src/lib/auth.tsx`: uusi `isOrganizer` (`organizer` tai `admin`) `AuthState`iin. `isOfficial` säilyy toimitsijan omaa näkymää varten.
   - Järjestäjänäkymien portit vaihdetaan `isAdmin || isOfficial` -tarkistuksesta `isOrganizer`-tarkistukseen: `toimitsija.kisa.$competitionId.tsx`, `toimitsija.talkoot.$competitionId.tsx`, `toimitsija.talkoot.index.tsx`, `toimitsija.aikataulu.$competitionId.tsx`, `toimitsija.index.tsx` (järjestäjäosio).
   - Aikataulu- ja luettelonäkymissä yhteystiedot ja lapsi-/sidonnaisuustiedot renderöidään vain `isOrganizer`-tilassa; muille näytetään pelkkä nimi (ja tarvittaessa rooli/lajijohtaja-merkintä).

3. **Käyttöoikeuksien hallinta**
   - `src/routes/admin.roles.tsx`: uusi valinta "kisajärjestäjä" (`organizer`) roolivalikkoon ja tyyppilistaan.

## Huomioitavaa

Kun toimitsija-rooli ei enää yksin riitä järjestelyihin, nykyiset pelkän toimitsija-roolin haltijat menettävät pääsyn järjestäjänäkymiin. Tarvittaville henkilöille myönnetään uusi kisajärjestäjä-rooli käyttöoikeussivulta.
