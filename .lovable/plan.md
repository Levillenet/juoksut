# Kilpailun järjestelyt: toimitsijat ja talkooväki

Sama valikkokokonaisuus, kaksi erillistä osiota. Osion nimi muuttuu muotoon "Kilpailun järjestelyt, toimitsijat ja talkooväki" (lyhyt muoto valikkokortissa: "Kilpailun järjestelyt"). Osion sisällä on kaksi selkeästi erillistä välilehteä:

- Lajitoimitsijat, nykyinen toiminnallisuus sellaisenaan
- Talkoo- ja järjestelytehtävät, uusi kokonaisuus

Tietomallit, ilmoittautumislinkit ja listat pidetään erillään: talkoorivit eivät näy toimitsijanäkymissä eivätkä toisinpäin. Vain navigaatio ja yhteinen otsikkotaso ovat jaettuja.

## Mitä käyttäjä näkee

### Järjestäjä, sivu /toimitsija/talkoot/:competitionId



- "Luo talkooryhmä": nimi (esim. Aitaryhmä), kuvaus, vastuuhenkilö, tarvittava henkilömäärä, päivä ja kellonaikaväli, kokoontumispaikka.
- Valmiit pohjat yhdellä klikkauksella: Aitaryhmä, Kahvio, Tekninen ryhmä, Tulospalvelu, Liikenteenohjaus, Pystytys, Purku, Kuulutus, Ensiapu. Pohjan voi nimetä ja muokata vapaasti.
- Ryhmälista päivittäin aikajärjestyksessä. Jokaisella ryhmällä: ilmoittautuneet nimineen ja puhelinnumeroineen, x/y täyttöaste, punainen merkintä kun väkeä puuttuu, vihreä kun täynnä.
- Talkoolaisen lisäys käsin nimellä ja puhelinnumerolla, ilman käyttäjätiliä.
- Yläreunassa yhteenveto: talkoopaikkoja yhteensä, täyttämättä, ryhmiä vajaana.
- "Avaa talkoohaku" tuottaa jaettavan linkin, jonka voi kopioida WhatsAppiin. Linkki toimii ilman kirjautumista.
- Tulostettava talkoolista: ryhmä, aika, paikka, vastuuhenkilö ja nimet.

### Talkoolainen, sivu /toimitsija/talkoot/haku/:token

- Kilpailun nimi, päivät ja lyhyt viesti järjestäjältä.
- Ryhmät päivittäin listattuna: tehtävän kuvaus, aika, paikka, vapaat paikat.
- "Ilmoittaudun": nimi, puhelin, valinnainen sähköposti. Kirjautuneelle esitäytetään tiedot.
- Voi ilmoittautua useaan ryhmään ja perua oman ilmoittautumisensa.
- Täynnä oleva ryhmä näkyy täytenä, mutta varalle voi ilmoittautua.

### Osion etusivu /toimitsija

- Otsikko "Kilpailun järjestelyt" ja kaksi korttia: "Lajitoimitsijat" ja "Talkoo- ja järjestelytehtävät".
- Kirjautuneelle näytetään molemmista omat vuorot: toimitsijatehtävät ja talkoovuorot omina listoinaan.
- Järjestäjälle kilpailulista, josta pääsee kummankin osion hallintaan.
- Yhteinen välilehtipalkki näkyy myös kilpailukohtaisilla sivuilla, jotta järjestäjä liikkuu toimitsijoiden ja talkoiden välillä yhdellä klikkauksella.

Etusivun valikkokortin teksti päivitetään: "Kilpailun järjestelyt, toimitsijat ja talkooväki". Sanasto pidetään erillään: talkootermit eivät esiinny toimitsijalistoissa eivätkä toimitsijatermit talkoolistoissa.


## Tekniset muutokset

Uudet taulut, kaikille GRANTit ja RLS:

- `volunteer_calls`: competition_id (uniikki), competition_name, competition_date, share_token (uniikki), open_from, open_until, message, opened_by. Julkinen luku vain tokenilla security definer -funktion kautta.
- `volunteer_tasks`: id, competition_id, name, description, day, start_time, end_time, location, needed_count, contact_name, contact_phone, sort_order, created_by.
- `volunteer_signups`: id, task_id, competition_id, user_id (nullable), full_name, phone, email, note, status (`signed` | `cancelled`), source (`self` | `organizer`), created_at.

RLS: admin ja official hallinnoivat kaikkea, kirjautunut näkee ja peruu omat ilmoittautumisensa. Tokenilla tapahtuva anonyymi ilmoittautuminen ja luku hoidetaan security definer -funktioilla `get_volunteer_call(_token)`, `list_volunteer_tasks(_token)` ja `volunteer_signup(_token, _task_id, _name, _phone, _email, _note)`, jotka tarkistavat että haku on auki. Suoria anon-oikeuksia tauluihin ei anneta.

Sovellus:

- `src/lib/volunteers.ts`: ryhmien ja ilmoittautumisten CRUD, tokenpohjaiset RPC-kutsut, täyttöasteen laskenta.
- `src/lib/volunteer-templates.ts`: valmiiden talkooryhmien pohjat.
- Uudet reitit: `src/routes/talkoot.tsx` (layout ja head), `src/routes/talkoot.index.tsx`, `src/routes/talkoot.kisa.$competitionId.tsx`, `src/routes/talkoot.haku.$token.tsx` (julkinen, ei kirjautumisvaatimusta), `src/routes/talkoot.lista.$competitionId.tulosta.tsx`.
- Uudet komponentit `src/components/volunteers/`: `VolunteerTaskDialog`, `VolunteerTaskCard`, `VolunteerSignupForm`, `VolunteerShareCard`.
- Kilpailupäivät johdetaan olemassa olevasta kilpailuindeksistä samalla tavalla kuin toimitsijapuolella, joten uusia kutsuja tuloslistalle ei synny.

## Ei tässä vaiheessa

Automaattiset sähköpostimuistutukset ja talkoovuorojen vaihtopyynnöt. Tietomalliin jätetään sähköpostikenttä valmiiksi.
