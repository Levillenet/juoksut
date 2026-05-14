## Tavoite

1. **Etusivulle** uusi osio "Päivän parhaat" — käyttäjä valitsee mitkä ikäluokat (esim. M, N, M14, T16…) kiinnostavat, ja näkee kunkin lajin parhaan tuloksen tämän päivän kisoista koko maasta.
2. **Seurattavien urheilijoiden listalle** (/watch) jokaisen urheilijan kohdalle pieni rivi: "Päivän paras samassa lajissa & ikäluokassa: 11.34 — Matti Meikä (HKV), Kalevan kisat" — eli mihin saman päivän tulokseen oma urheilija vertautuu.

Molemmat osiot lukevat vain valmiiksi tallennettua dataa `athlete_results`-taulusta — eivät käynnistä mitään hakua selaimessa.

---

## Mitä puuttuu nyt

- Tausta-keräys (cron) on juuri käynnistynyt, `harvest_state` on vielä `next_id=17000`. Backfill etenee 10 min välein. Tämä muutos ei vaadi backfillin valmistumista — toimii sitä mukaa kun dataa kertyy.
- `athlete_results`-taulussa ei ole ikäluokka-saraketta. API:n `Round.GroupName` ("M", "N", "M14", "T16", "P12"…) on luonteva avain — lisätään se talteen.

---

## Tekniset muutokset

### 1. Migraatio
- Lisää `athlete_results.age_class text NOT NULL DEFAULT ''` + indeksi `(competition_date, age_class, event_name)` päivän parhaiden hakua varten.

### 2. Harvester (`src/routes/api/public/hooks/harvest-results.ts`)
- Lue `competition/{id}` -vastauksesta jokaiselle EventId:lle `GroupName` (mappaa eventId → groupName).
- Tallenna `age_class`-kenttä jokaiselle riville. Olemassa olevat rivit täytetään seuraavalla skannauskierroksella, kun cursor pyörii tail-moodissa.

### 3. Yhteinen kysely-helpperi (`src/lib/daily-best.ts` – uusi)
- `fetchDailyBest(dateISO, ageClasses[])` → palauttaa lajeittain ryhmiteltynä kunkin lajin parhaan tuloksen (top 1 per `event_name + age_class`), suorittajan + seuran + kilpailun nimen.
  - Server-fn `createServerFn` jolla pieni RPC; tekee yhden kyselyn rajatulla `competition_date`-välillä (Helsinki-päivän alku/loppu) ja suodattaa age_classit `IN (...)`. Käyttäjäpuolella vain luetaan tulokset.
- `fetchDailyBestForAthlete(athleteKey, dateISO)` → palauttaa parhaat per laji niissä lajeissa joissa kyseinen urheilija itse kilpaili samana päivänä, samassa age_classissa.

### 4. Etusivu (`src/routes/index.tsx`)
- Lisää uusi `<DailyBestSection />` ennen tai jälkeen lajilistauksen.
- Yläpalkissa "siru-rivi" jolla valitaan ikäluokat; näytetään vain ne age_classit jotka esiintyvät kyseisen päivän datassa. Valinta tallennetaan `localStorage`iin (`dailyBest.ageClasses`).
- Lista: laji → parhaan tulos isolla, alle suorittaja + seura + kisan nimi. Tyhjän tilan teksti jos ikäluokkia ei valittu / ei dataa vielä.

### 5. Seurantalista (`src/routes/watch.tsx`)
- Hae kerran (`useQuery`) seurattavien `athleteKey`it käyttäen `fetchDailyBestForAthlete` (yksi RPC, palauttaa map: athleteKey → laji → paras).
- Renderöi olemassa olevan urheilijakortin alle pieni rivi:
  > "Päivän paras 100m M14: **11.34** — Matti Meikä (HKV) · Kalevan kisat"
- Jos urheilijalla ei ole tulosta tänään → ei näytä mitään extra-riviä.

### 6. Pieni siisti
- Korjaa `src/routes/watch.tsx` mahdollinen JSX-tasapaino-virhe (preview ilmoitti aiemmin "Expected closing tag for div (572:10)") samalla läpiluvulla.

---

## Käyttäjäkokemus

```text
ETUSIVU
┌──────────────────────────────┐
│  Lahden Ahkera · Kisa #18800 │
│  [ M | N | M14 | T16 | + ]   │ ← ikäluokkien valintasirut
├──────────────────────────────┤
│  PÄIVÄN PARHAAT              │
│  100 m M14   11.34  Meikä..  │
│  Pituus T14   5.42  Virta..  │
│  …                           │
├──────────────────────────────┤
│  Juoksulajit (kuten ennen)   │
└──────────────────────────────┘

SEURANTALISTA — urheilijakortti
┌──────────────────────────────┐
│  📌 Maija Mäkinen (KalPa)    │
│     400m esierä klo 14:20    │
│     ─ Päivän paras M14:      │
│       11.34 — Meikä (HKV)    │
└──────────────────────────────┘
```

---

## Avoimet kysymykset (oletukset jollei kerro toisin)

- **"Päivä"** = Helsingin aikavyöhykkeen tämä päivä (kaikki kisat koko maassa).
- **Ikäluokan tunniste** = API:n `GroupName` (M, N, M14, T16…). Näytetään selkokielisinä sirujen labeleissa.
- **Default-valinnat**: ei mitään ennen kuin käyttäjä valitsee — säilyy localStorageen.
