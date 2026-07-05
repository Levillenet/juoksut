## Tavoite

Päivän videot -sivulla erävideoihin (esim. "T11 60 m aidat, erä 1") lisätään laajennettava osio, joka näyttää kyseisen erän juoksijat ja heidän tuloksensa.

## Muutokset

### 1. `src/lib/public-videos.ts`
Lisää uusi funktio `fetchHeatResults(competitionId, eventName, subCategory)`:
- Hakee `athlete_results`-rivit joilla `competition_id`, `event_name` ja `sub_category` täsmäävät (sub_category on erän tunniste, esim. "Erä 1").
- Palauttaa listan: `surname`, `firstname`, `organization`, `result_text`, `result_rank`, `age_class` — järjestettynä `result_rank` mukaan (nulls last).
- Ryhmittele duplikaatit `athlete_key`:n mukaan (uusin `captured_at`).

### 2. `src/routes/videot.tsx`
- Näytä laajennusnappi vain erävideoille (`v.athlete_key.startsWith("heat:")`).
- Nappi kortin alaosaan: pieni chevron + teksti "Näytä erän tulokset".
- Klikkaus lataa tulokset lazysti (useQuery) ja näyttää ne pieninä riveinä:
  `1. Sukunimi Etunimi (seura) — 9,87`
- Ei avaa videomodalia — pysäytä `stopPropagation`.
- Käytä `Collapsible`-komponenttia (`@/components/ui/collapsible`) tai natiivi `<details>`.

## Tekniset huomiot

- Erä tunnistetaan: `athlete_key` alkaa `"heat:"` ja `sub_category` sisältää erän nimen.
- Ei-erävideoihin (yksittäisen urheilijan video) ei laajennusta lisätä — niissä tieto on jo kortissa.
- Kortin `button`-elementti sisältää nyt sisäkkäisen napin → vaihda ulompi `button` `div`iksi, jolla `onClick` avaa modalin, ja laajennusnappi on erillinen `button` `stopPropagation`illa. Tämä pitää a11y:n kunnossa ja välttää nested-button varoitukset.
