## Tavoite

Lisätään admin-näkymään työkalu, jolla kilpailusta saa Excel-tiedoston, jossa kullekin lajille näkyy aloitusaika, osanottajamäärä, viimeisen tuloksen tallennusaika ja siitä laskettu kesto. Juoksulajeille lisäksi erien lukumäärä ja osanottajat yhteensä kaikista eristä.

## Muutokset

### 1. Reitti uudelleennimettynä: `/admin/analytics` → "Admin-valikko"

- `src/routes/admin.analytics.tsx`: vaihdetaan otsikko **"Käyttöanalytiikka"** → **"Admin-valikko"** ja `head` meta `title: "Admin-valikko"`.
- Lisätään sivun alkuun kevyt tab-/osio-rakenne: **Käyttöanalytiikka** (nykyinen sisältö) ja **Lajien kestot** (uusi). Reittipolku säilyy `/admin/analytics`-osoitteessa toistaiseksi, jotta admin-bookmarkit eivät rikkoudu.

### 2. Uusi osio "Lajien kestot"

UI sisältää:
- Kilpailun valinta (oletuksena nykyinen `useCompetitionId()`-arvo, vaihdettavissa numerokentällä).
- Painike **"Lataa ja vie Excel"** sekä yhteenvetotaulukko esikatselua varten.

Lataaminen tekee rinnakkain:
1. `fetchRounds(competitionId)` (tuloslista-aikataulu, jo olemassa `src/lib/tuloslista.ts`).
2. Per laji `fetchEvent(competitionId, eventId)` → saadaan `Rounds[].Heats[]` ja kunkin lajin Track/Field-luonne. Pyynnöt batchataan (esim. 6 rinnakkain) menemättä päälle palvelimen rajoja.
3. Yksi Supabase-kysely: `athlete_results` taulusta `competition_id = ?` — palautetaan `event_id`, `captured_at`, `athlete_key`. Lasketaan paikallisesti `max(captured_at)` ja `count(distinct athlete_key)` per lajiin.

### 3. Yhden rivin lasenta (per laji)

| Sarake | Lähde |
| --- | --- |
| Laji-ID | `EventId` |
| Lajin nimi | `EventName` |
| Sarja / ryhmä | `Name` / `GroupName` |
| Kategoria | Track / Field (suomennettuna) |
| Alkamisaika | aikataulun varhaisin `BeginDateTimeWithTZ` lajin kaikkien Round-rivien yli (Helsinki-aika) |
| Erien määrä (vain juoksut) | `Rounds[].Heats.length` summa |
| Osanottajat ilm. (aikataulu) | `Round.CountConfirmed` (tai `CountEnrolled` jos confirmed puuttuu); juoksuilla summa kaikista eristä |
| Osanottajat tuloksissa | `athlete_results`: distinct `athlete_key` per event_id |
| Viimeinen tulos | `max(captured_at)` |
| Kesto (min) | `(viimeinen tulos − alkamisaika)` minuutteina; tyhjä jos ei tuloksia |
| Status | tuloslistan `Status` (esim. Virallinen / Käynnissä) |

Huom: kesto perustuu omaan `captured_at`-aikaleimaamme (harvesterin syke ~minuutteja). Tämä todetaan vienti­tiedoston yläriville selitteenä.

### 4. Excel-vienti

- Lisätään `xlsx`-paketti (`bun add xlsx`) ja muodostetaan tiedosto selainpuolella `XLSX.utils.json_to_sheet` + `XLSX.writeFile`.
- Tiedostonimi: `lajien-kestot-<competitionId>-<YYYY-MM-DD>.xlsx`.
- Kaksi välilehteä: **"Kaikki lajit"** (yllä kuvattu taulukko) ja **"Juoksut yhteenveto"** (vain Track-lajit, sarakkeet: laji, erät, osanottajat yhteensä).

### 5. Tekninen toteutus

- Uusi pieni moduuli `src/lib/event-durations.ts`:
  - `buildEventDurationRows(competitionId)` → palauttaa rivit yllä olevassa muodossa.
  - Hyödyntää `fetchRounds`, `fetchEvent` ja yhden Supabase-kyselyn.
- Uusi komponentti `src/components/admin/EventDurationsSection.tsx`, renderöidään `admin.analytics.tsx`-sivulle uutena osiona.
- Käyttää nykyistä admin-gateä (`ADMIN_EMAIL`-tarkistus). Ei uusia RLS-policyjä — `athlete_results` on jo luettavissa kirjautuneelle adminille nykyisillä säännöillä; jos kysely epäonnistuu oikeuksien takia, fallback `createServerFn`:lla admin-tarkistuksen kanssa (käyttää `supabaseAdmin`).

### 6. Tulevaisuuden käyttö

Data on suunniteltu uudelleenkäytettäväksi tulevassa kilpailujen aikataulutus­työkalussa: sama `buildEventDurationRows` voidaan ajaa useammalta vanhalta kisalta ja koostaa ennusteita lajien kestoista.

## Ulkopuolelle jää

- Ei vielä historiakoostetta useammalta kisalta (rakenne valmistellaan, mutta UI tehdään myöhemmin).
- Ei muuteta `/admin/analytics`-osoitetta itseään; vain otsikko ja sivun rakenne. Mahdollinen siirto `/admin`-juureen voidaan tehdä, kun valikkoon tulee lisää työkaluja.
