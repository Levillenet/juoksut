
## Mitä rakennetaan

Etusivulle (`/`) uusi laajennettava **"Kauden tilastot"** -osio, joka näyttää seuratut urheilijat (`watched_athletes`) valitulta kaudelta ja ikäluokalta. Erillinen toimitsijapuolen hallintanäkymä seurojen kotipaikoille km-laskentaa varten.

## Käyttäjän valinnat

- **Kausi**: pudotusvalikko – Kuluva vuosi (1.1.–31.12.) / Kesäkausi (1.5.–30.9.) / Talvikausi (1.10.–30.4.)
- **Ikäluokka**: pudotusvalikko, vaihtoehdot haetaan `athlete_results.age_class`-arvoista, jotka esiintyvät seurattujen urheilijoiden tuloksissa valitulla kaudella
- Oletus: kuluva vuosi, "kaikki ikäluokat"

## Mittarit per urheilija (taulukko)

| Mittari | Laskenta |
|---|---|
| Lajien määrä | uniikit `normalize_event_name(event_name)` |
| Kisojen määrä | uniikit `competition_id` |
| Tunnit kisapaikalla | per kisapäivä: 1 h ennen + 0,5 h jälkeen + 0,5 h × (lajien_määrä − 1) arvio (ks. tekninen huom.) |
| Juostut metrit yhteensä | summa `event_name`-merkkijonosta parsituista metreistä (`Track`-kategoria, esim. "60m" → 60, "1500m" → 1500). Aidat lasketaan myös. |
| PB:t | `was_pb = true` rivien määrä |
| Voitot | `result_rank = 1` rivien määrä |
| Matkustetut km | per kisa: 2 × Haversine(seuran kotipaikka, kilpailupaikka), summattuna |

Yhteenveto-rivi alas (kaikkien urheilijoiden summat). Sarakkeet järjestettäviä.

## Seurojen kotipaikkojen hallinta (toimitsijapuoli)

Uusi sivu **`/admin/club-locations`** (vain kirjautuneille).
- Lista kaikista `organization`-arvoista, joita esiintyy `athlete_results`-taulussa
- Per seura: nimi + lat/lng + paikkakunta-tekstikenttä
- "Ehdota koordinaatteja" -nappi käyttää OpenStreetMap Nominatim -ilmaisrajapintaa (server-fn) paikkakunnan nimellä
- Tallennus uuteen tauluun `organization_locations`

## Tekniset muutokset

**Tietokanta (1 migraatio)**
- `organization_locations`-taulu: `organization_id` (PK), `organization_name`, `city`, `lat`, `lng`, `updated_at`. RLS: kaikki autentikoidut voivat lukea + insertoida (samaa mallia kuin nykyiset taulut). Update sallitaan autentikoiduille.
- `competition_locations`-taulu: `competition_id` (PK), `location` (text), `lat`, `lng`. Täytetään lazy: kun km-laskenta tarvitsee kilpailun koordinaatit ja niitä ei ole, server-fn geokoodaa `athlete_results.location`-kentästä Nominatimilla ja tallentaa.

**Server functions** (`src/lib/season-stats.functions.ts`)
- `getSeasonStats({ season, ageClass })` – vaatii authin, hakee watched_athletes ∩ athlete_results suodatettuna kaudella ja ikäluokalla, palauttaa per-urheilija-rivit (kaikki mittarit valmiiksi laskettuna palvelimella). Käyttää `supabase` (RLS) watched-listalle ja `supabaseAdmin` athlete_results-aggregointiin tehokkuuden vuoksi.
- `geocodeOrganization({ name, city })` ja `geocodeCompetition({ competitionId })` – Nominatim-kutsut, server-only.
- `upsertOrganizationLocation({...})` – auth, manuaalinen tallennus.

**Client/UI**
- `src/components/SeasonStatsSection.tsx` – uusi laajennettava paneeli `ClubTodaySection`-tyylillä, käyttää `useQuery` + `useServerFn`.
- `src/routes/index.tsx` – lisätään `<SeasonStatsSection />` `<ClubTodaySection />`-osion alle.
- `src/routes/admin.club-locations.tsx` – uusi reitti, taulukko + edit-rivi per seura.
- Linkki "Seurojen sijainnit" toimitsijapuolen valikkoon (etsitään olemassa olevasta navigaatiosta).

**Apufunktiot** (`src/lib/season-stats.ts`)
- `parseTrackDistanceMeters(eventName: string): number | null` – regex `(\d+)\s*m\b`, palauttaa metrit tai null.
- `seasonRange(season): { from: Date, to: Date }`.
- `haversineKm(a, b)`.
- `estimateHoursAtVenue(eventsCount: number): number` – `1 + 0.5 + 0.5 * (eventsCount - 1)` per kisapäivä, vähintään 1.5 h.

## Avoin oletus (vahvistus suotavaa, ei estä toteutusta)

**Tunnit kisapaikalla** – `athlete_results.captured_at` on harvesterin ajastus, ei urheilijan oikea aikaleima. Käytetään arviota: 1.5 h pohjaksi per kisapäivä + 0.5 h × (urheilijan lajit kisassa − 1). Tämä on lähellä todellisuutta tyypillisessä kisassa, mutta ei tunne lajien välistä taukoa. Voidaan myöhemmin vaihtaa kisaohjelman aikaleimoihin, jos sellainen data tulee saataville.

---

## Kuuluttajan moodit (toteutettu)

`/announcer` jaettu kolmeen valittavaan moodiin:
- `/announcer/combined` – nykyinen yhden laitteen näkymä
- `/announcer/live` – aktiivinen kuulutus: PB/SB-banneri full-tilassa + käynnissä olevat lajit yhden palstan kortteina (oletuksena auki)
- `/announcer/planning` – seuraavat lajit ilman 20-rajaa + lopputulokset dismiss-toiminnolla

Yhteinen tilanhallinta `useAnnouncerData`-hookissa (Tanstack Query -cache jaetaan eri reittien välillä). Valintasivu `/announcer` muistaa moodin laitekohtaisesti localStoragessa avaimella `announcer.preferredMode`.

### Avoin: dismissalit eri laitteiden välillä

`dismissedCompletedIds` on edelleen per-laite (localStorage). Kun kuuluttaja merkitsee Live- tai Planning-tabletilla lopputuloksen luetuksi, toinen laite ei tiedä siitä. Synkronointi Supabaseen (esim. taulu `announcer_dismissed`) tehdään seuraavassa vaiheessa – vasta sen jälkeen kun käytännön käyttö varmistaa että dismiss on hyödyllinen tila kahdella laitteella.
