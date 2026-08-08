# Toimitsijaominaisuus, vaihe 1

Tavoite: korvata WhatsApp-sähläys. Toimitsija luo profiilin ja kiinnittää omat lapsensa, järjestelytoimikunta rakentaa kilpailun lajilistalle toimitsijaluettelon ja saa automaattiset ehdotukset. Varmennussähköpostit tulevat vaiheessa 2, mutta tietomalli rakennetaan niin, että ne voidaan lisätä ilman muutoksia rakenteeseen.

## Mitä käyttäjä näkee

**Etusivun uusi kortti "Toimitsijat"** (näkyy kirjautuneille).

**1. Oma toimitsijaprofiili, /toimitsija**
- Nimi, sähköposti (esitäytetään tilistä), puhelinnumero, seura, vapaa lisätieto (esim. osaaminen: sähköinen ajanotto, kuulan mittaus).
- "Omat urheilijat": haku samalla hakukomponentilla kuin kilpailijaseurannassa. Urheilija vain kiinnitetään itselle, sukulaisuussuhdetta ei kysytä. Yksi rasti: "Olen huoltaja". Sama urheilija voi olla kiinnitettynä usealle toimitsijalle (isä, äiti, mummo, pappa). Lista poistettavissa.
- "Käytettävissä kisoihin": lista tulevista kilpailuista, joihin järjestelytoimikunta on avannut toimitsijahaun. Käyttäjä merkitsee itsensä käytettäväksi ja voi kirjoittaa rajoitteen (esim. vain lauantaina).

**2. Järjestelytoimikunnan näkymä, /toimitsija/kisa/$competitionId**
- Kilpailu valitaan samalla kilpailuvalitsimella kuin muuallakin, lajilista haetaan live-aikataulusta (sama aikataulurajapinta ja välimuisti kuin kuuluttajanäkymässä), joten lajeja ei syötetä käsin.
- Vain kenttälajit. Kaikki juoksu- ja viestilajit rajataan pois listalta, koska juoksujen toimitsijat hoidetaan eri prosessissa.
- Lajit aikajärjestyksessä, jokaisella: tarvittava toimitsijamäärä, kiinnitetyt toimitsijat, tila (ehdotettu, pyydetty, varmennettu, kieltäytynyt).
- Jokaisen lajin kohdalla "Ehdota toimitsijoita": lista järjestyksessä
  1. lajissa kilpailevien urheilijoiden huoltajat,
  2. muut, jotka ovat kiinnittäneet saman urheilijan itselleen,
  3. kisaan käytettäväksi ilmoittautuneet,
  4. muut profiilin luoneet.
  Samaan aikaan toisessa lajissa kiinni olevat merkitään varatuiksi.
- Yhteenveto: montako lajia ilman toimitsijaa, montako vajaata.
- Yhteystiedot ja lapsikytkennät näkyvät vain järjestelytoimikunnalle ja adminille.

**3. Oikeudet**
- Roolia `official` käytetään toimitsijaprofiilin luomiseen ei vaadittavana; profiilin voi luoda kuka tahansa kirjautunut.
- Järjestelytoimikunnan näkymään pääsevät `admin` ja `official`.

## Vaihe 2, ei nyt

Varmennuspyyntö sähköpostilla, julkinen token-linkki (/toimitsija/varmenna/$token), vastausaikaikkuna, muistutus ja järjestelytoimikunnan näkymä "ei varmennettu".

## Tekninen toteutus

Uudet taulut (RLS + GRANT jokaiselle):
- `official_profiles`: user_id (uniikki), full_name, email, phone, club, skills, notes.
- `official_children`: official_profile_id, athlete_key, surname, firstname, organization, organization_id, is_guardian (huoltaja kyllä/ei). Uniikki pari (profiili, athlete_key), mutta sama athlete_key voi toistua eri profiileilla.
- `official_competition_calls`: competition_id, competition_name, opened_by, open_from, open_until, message. Järjestelytoimikunta avaa toimitsijahaun.
- `official_availability`: user_id, competition_id, available, constraint_note.
- `official_assignments`: competition_id, event_id, round_id, event_name, age_class, starts_at, official_profile_id, role_label, status (`proposed|requested|confirmed|declined`), confirm_token, requested_at, responded_at.

Näkyvyys: profiilin ja lasten luku vain omistajalle sekä `has_role(auth.uid(),'admin'|'official')`. Kirjoitus vain omistajalle. Assignmentit ja callit: luku kirjautuneille toimitsijoille, kirjoitus admin/official.

Ehdotuslogiikka tehdään palvelinfunktiossa (`src/lib/officials.functions.ts`, `requireSupabaseAuth`): se ottaa lajin osallistujat live-aikataulusta tulevasta allokaatiolistasta, muodostaa athlete_keyt samalla `athleteKey`-funktiolla ja liittää ne `official_children`-riveihin. Huoltajat (is_guardian) nousevat listan kärkeen, muut kiinnittäjät heti perään, sitten käytettävissä olevat ja loput. Kenttälajisuodatus tehdään olemassa olevalla `isRunningEvent`-logiikalla käänteisesti (`src/lib/tuloslista.ts`).

Uudet tiedostot: `src/routes/toimitsija.index.tsx`, `src/routes/toimitsija.kisa.$competitionId.tsx`, `src/components/officials/*`, `src/lib/officials.functions.ts`, `src/lib/officials.ts`. Muutos `src/routes/index.tsx` (kortti).

Lajien haku käyttää olemassa olevaa `competitionIndexQueryOptions`-indeksiä, joten uusia origin-kutsuja tuloslistalle ei synny.
