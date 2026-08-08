# Toimitsijajärjestelmä, vaihe 2

Toimitsijahaku aukeaa jaettavalla linkillä, toimitsijat kiinnittävät itse itsensä kenttälajeille kirjautuneina, ja vastuuhenkilö näkee yhdellä silmäyksellä mistä lajeista puuttuu väkeä. Sähköpostiautomaatio tulee myöhemmin, tietomalli rakennetaan valmiiksi sitä varten.

## Mitä käyttäjä näkee

### 1. Toimitsijavastuuhenkilö (admin tai toimitsija-asettaja)

Sivulla /toimitsija/kisa/:id:

- "Avaa toimitsijahaku": valitaan kilpailu, hakuaika (esim. viikko ennen), vapaa viesti. Avaamisen jälkeen näkyviin tulee jaettava linkki, jonka voi kopioida ja lähettää WhatsAppiin tai sähköpostiin.
- Lajilista aikajärjestyksessä, vain kenttälajit. Jokaisella lajilla:
  - tarvittava minimimäärä toimitsijoita, muokattavissa suoraan riviltä,
  - kiinnitetyt toimitsijat ja heidän tilansa,
  - punainen huutomerkki ja punainen reunus, kun minimimäärä ei täyty; vihreä merkki kun täyttyy.
- Yläreunassa yhteenveto: montako lajia punaisella, montako kiinnitystä varmentamatta.
- "Lisää toimitsija" lajille:
  - valitse listalta kuka tahansa toimitsijakortin luonut,
  - tai kirjoita nimi käsin: järjestelmä luo automaattisesti toimitsijakortin (nimi, valinnainen sähköposti ja puhelin), joka voidaan myöhemmin liittää oikeaan käyttäjätiliin ja jota voi muokata.
  - Ehdotuslista kuten ennenkin: huoltajat lajissa kilpailevista ensin, sitten muut kiinnittäjät, sitten käytettäväksi ilmoittautuneet.
  - Listalla näkyy varoitus, jos toimitsija ei ole ilmoittanut olevansa käytettävissä kyseisenä päivänä tai laji on hänen ilmoittamansa aikavälin ulkopuolella, sekä jos hänellä on päällekkäinen kiinnitys.
- "Lähetä varmennuspyynnöt": merkitsee kaikki ehdotetut kiinnitykset tilaan "pyydetty" ja tuottaa jaettavan varmennuslinkin. Toimitsija kuittaa oman aikataulunsa kortiltaan.
- Vastuuhenkilö voi vaihtaa, poistaa ja siirtää kiinnityksiä milloin tahansa.

### 2. Toimitsija (kirjautunut käyttäjä)

Sivulla /toimitsija:

- Toimitsijakortti kuten nyt (nimi, yhteystiedot, seura, osaaminen, omat urheilijat huoltajamerkinnällä).
- "Avoimet toimitsijahaut": jokaisesta kilpailusta oma kortti.
  - Monipäiväisessä kilpailussa jokainen kilpailupäivä listataan erikseen. Päivälle valitaan: en ole käytettävissä / käytettävissä.
  - Käytettävissä olevalle päivälle valitaan aikaväli alasvetovalikoista (alkaa, päättyy). Oletus on "koko päivä", eli kilpailun kyseisen päivän aikataulun ensimmäisestä lajista viimeiseen. Vaihtoehdot ovat tasatunteja kyseisen päivän aikataulun sisällä, esim. 12–15.
  - Vastauksen jälkeen näkyy sen päivän kenttälajit aikajärjestyksessä. Ilmoitetun aikavälin ulkopuoliset lajit ovat harmaana eikä niitä voi valita. Toimitsija merkitsee itsensä haluamilleen lajeille.
  - Laji, jossa minimimäärä on jo täynnä, näytetään täytenä mutta siihen voi silti ilmoittautua vara-avuksi.
- "Oma aikataulu": lista omista kiinnityksistä kilpailuittain, tulostusnäkymä (/toimitsija/aikataulu/:competitionId/tulosta) jossa nimi, kilpailu, päivä, kellonaika, laji, sarja ja suorituspaikka.
- Varmennuspyynnön jälkeen kortilla näkyy "Varmenna aikataulu" -painike, joka merkitsee kaikki omat kiinnitykset varmennetuiksi, ja mahdollisuus kieltäytyä yksittäisestä lajista.

## Tekniset muutokset

Tietokanta:

- `official_profiles`: `user_id` muuttuu nullableksi (käsin luodut kortit), lisätään `created_by` ja `claimed_at`. Uniikkiehto vain kun `user_id` ei ole null. Luku ja muokkaus: omistaja sekä admin/official.
- `official_competition_calls`: lisätään `share_token` (uniikki), `open_from`, `days` (kilpailupäivät ja niiden aikaikkunat aikataulusta johdettuna).
- Uusi `official_day_availability`: profile_id, competition_id, day (date), available, start_time, end_time. Uniikki (profile_id, competition_id, day).
- Uusi `official_event_requirements`: competition_id, round_id, event_id, event_name, age_class, starts_at, min_officials (oletus 2). Uniikki (competition_id, round_id).
- `official_assignments`: lisätään `source` (`self` | `organizer`), `day` (date) ja pidetään olemassa oleva `status` (`proposed|requested|confirmed|declined`) sekä `confirm_token` valmiina sähköpostivaihetta varten.

Jokaiselle uudelle taululle GRANTit ja RLS: toimitsija näkee ja kirjoittaa omat rivinsä, admin ja official näkevät ja hallitsevat kaikkia.

Sovellus:

- `src/lib/officials.ts`: uudet funktiot päiväkohtaiselle käytettävyydelle, minimimäärille, käsin luodulle kortille, itsekiinnitykselle ja varmennukselle.
- `src/lib/officials-schedule.ts`: kilpailupäivien ja päiväkohtaisten aikaikkunoiden johtaminen `competitionIndexQueryOptions`-aikataulusta, kenttälajisuodatus nykyisellä `isRunningEvent`-logiikalla, tasatuntivalikoiden muodostus.
- Uudet reitit: `src/routes/toimitsija.haku.$competitionId.tsx` (toimitsijan oma ilmoittautuminen, jaettavan linkin kohde, vaatii kirjautumisen), `src/routes/toimitsija.aikataulu.$competitionId.tulosta.tsx` (tulostus).
- Päivitykset: `src/routes/toimitsija.kisa.$competitionId.tsx` (minimimäärät, punaiset huutomerkit, käsin lisäys, jaettava linkki, varmennuspyynnöt), `src/routes/toimitsija.index.tsx` (avoimet haut, päiväkohtainen käytettävyys, oma aikataulu).
- Uudet komponentit `src/components/officials/`: `CallShareCard`, `DayAvailabilityEditor`, `EventStaffingRow`, `ManualOfficialDialog`, `MyOfficialSchedule`.

Aikatauludata haetaan olemassa olevan välimuistitetun kilpailuindeksin kautta, joten uusia kutsuja tuloslistalle ei synny.

## Ei tässä vaiheessa

Automaattiset sähköpostit kutsuista ja varmennuksista. Tietomalli (share_token, confirm_token, requested_at) rakennetaan nyt niin, että lähetys voidaan kytkeä päälle ilman rakennemuutoksia.
