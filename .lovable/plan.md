## Analytiikkasivun parannukset

Selkeytetään `/admin/analytics`-sivun yläosaa ja lisätään päiväkohtainen näkymä, josta näkee sekä uniikit että kokonaiskävijämäärät päivätasolla.

### Muutokset

**1. Yläosan tunnusluvut (StatCard-rivi) – uudelleenjärjestys ja selitteet**

Korvataan nykyiset 5 korttia selkeämmillä, ryhmiteltyinä "tänään / 7 pv / kaikki":

- **Tänään – uniikit kävijät** (todayUsers, jo laskettu)
- **Tänään – tapahtumia** (rows joissa day === today)
- **7 pv – uniikit kävijät** (uniikkien visitorId:iden määrä viim. 7 päivältä)
- **7 pv – tapahtumia**
- **Kaikkiaan – uniikit kävijät** (kaikki visitorId:t, ei vain kirjautuneet)
- **Kaikkiaan – kirjautuneet käyttäjät** (uniikit user_id, nykyinen uniqueUsers)
- **Kaikkiaan – tapahtumia** (total)

Lisätään jokaiseen korttiin pieni alaselite (esim. "uniikit selaimet/sessiot" vs. "kirjautuneet tilit"), jotta käsitteet ovat selvät.

**2. Uusi taulukko: "Päivittäin – uniikit ja yhteensä"**

Yhdistetään nykyiset erilliset taulukot `byDay` (tapahtumat) ja `byDayUnique` (uniikit) yhdeksi taulukoksi, jossa sarakkeet:

```
Päivä | Uniikit kävijät | Kirjautuneet uniikit | Tapahtumia yhteensä
```

- Uniikit kävijät = nykyinen byDayUnique (user_id ‖ email ‖ user_agent)
- Kirjautuneet uniikit = uniikit user_id per päivä (uusi laskenta)
- Tapahtumia yhteensä = nykyinen byDay

Järjestys: uusin päivä ylimpänä. Bar-palkki suhteutuu uniikkien kävijöiden maksimiin.

**3. Poistettavat / siivottavat osiot**

- Poistetaan erilliset osiot "Päivittäin (tapahtumat)" ja "Päivittäin (uniikit käyttäjät)" – korvautuvat yhdistetyllä taulukolla.
- StatCard "Päiviä"-laatikko poistetaan (vähäarvoinen).

### Tekniset yksityiskohdat

Muutokset rajataan tiedostoon `src/routes/admin.analytics.tsx`:

- Laajennetaan `useMemo`-laskenta tuottamaan:
  - `last7dUsers: number`, `last7dEvents: number`
  - `allUniqueVisitors: number` (kaikki visitorId:t, ei vain kirjautuneet)
  - `todayEvents: number`
  - `byDayCombined: { day, uniqueVisitors, uniqueLoggedIn, events }[]`
- Päiväavain pysyy `created_at.slice(0,10)` (UTC) – sama kuin nyt, joten yhteensopiva olemassa olevan logiikan kanssa.
- Ei tietokantamuutoksia, ei uusia kyselyitä – kaikki johdetaan jo haetusta `analytics_events`-aineistosta.

Ei muutoksia muihin tiedostoihin tai komponentteihin.
