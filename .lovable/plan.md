## Tavoite

Pidetään kuuluttajan yhdistetty näkymä rauhallisempana: ennätyspalkki ja lopputulokset eivät enää aukea automaattisesti. Kuuluttaja avaa ne itse kun haluaa. Lopputulosten oletusavaus on lisäksi kytkettävissä asetuksena yläpalkista.

## Muutokset

### 1. RecordsBanner — oletuksena pienennettynä
- `src/components/announcer/RecordsBanner.tsx`: `useState(false)` → `useState(true)` `collapsed`-tilalle, **kun** `variant === "compact"` (yhdistetty + live). `variant === "full"` (planning) jatkaa auki.
- Otsikko, lukumäärä ja "Avaa"-nappi pysyvät näkyvissä, joten kuuluttaja avaa yhdellä klikillä.

### 2. Lopputulokset — oletuksena kiinni + asetus
- Uusi tallennettu asetus `announcer.autoOpenCompleted` (default `false`) `localStorage`iin. Lisätään `src/lib/settings-store.ts`:ään saman tyylinen hook kuin `useRefreshIntervalSec`: `useAutoOpenCompleted(): [boolean, (v: boolean) => void]`.
- `src/components/announcer/CompletedSection.tsx`: poistetaan `defaultOpen`-prop kovakoodattu `UpcomingItem`-kutsusta ja luetaan asetus storesta. Kun `false`, kortit renderöidään kiinni — käyttäjä napsauttaa otsikkoa avatakseen (UpcomingItem osaa tämän jo).
- Vaikuttaa myös `announcer.live.tsx`-näkymässä jos siellä käytetään `CompletedSection`ia (sama logiikka, sama asetus).

### 3. Asetus yläpalkkiin
- `src/components/announcer/AnnouncerHeader.tsx`: lisätään pieni hammasratasnappi (`Settings`-ikoni `lucide-react`istä) joka avaa olemassaolevan shadcn `Popover`in. Popoverissa:
  - Switch "Avaa lopputulokset automaattisesti" → kytketty `useAutoOpenCompleted`iin.
  - (Mahdollinen tilavaraus tulevia kuuluttaja-asetuksia varten — ei lisätä muita nyt.)
- Sijoitus: WakeLockToggle- ja Vaihda moodia -nappien viereen, ennen päivitysnappia. Mobiilissa pelkkä ikoninappi.

## Mitä ei muuteta

- Ei kosketa dataan, hookkeihin (`useAnnouncerData`), tickeriin, eikä `_layout`/routing-rakenteeseen.
- Planning-näkymässä `RecordsBanner variant="full"` säilyy oletuksena auki (siellä se on koko sivun ydin).
- Käynnissä olevien tulosten oletusavaus (`InProgressSection`) ei muutu.

## Tekniset huomiot

- `useAutoOpenCompleted` palauttaa SSR-turvallisen oletuksen (`false`) ja kuuntelee storeen subscribattuja muutoksia, jotta useammassa välilehdessä avattu asetus heijastuu heti.
- `CompletedSection`in jokaiselle kortille välitetään sama `defaultOpen={autoOpen}` — yksittäisten korttien `useState(defaultOpen)` `UpcomingItem`issa toimii jo.
