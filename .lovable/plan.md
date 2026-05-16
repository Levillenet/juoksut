## Tavoite

En vielä toteuttanut — olin suunnittelutilassa. Tässä tarkennettu, käyttöön valmis suunnitelma. Rajataan ensimmäinen toteutus **vain kuuluttajanäkymään** (combined + live + planning). Seurattavien sovellus root-tasolla jää myöhemmälle iteraatiolle.

## Käyttäytyminen

- Kiinteä palkki kuuluttajanäkymän alalaidassa, koko ruudun leveys, yksi rivi korkeudeltaan (~44 px).
- **Viimeisin viesti jää näkyviin**, kunnes uusi korvaa sen (slide-in animaatio vasemmalta).
- Palkin oikeassa reunassa pieni laskuri ja **▲-nappi**, joka avaa ylöspäin liukuvan paneelin (max ~40 vh, scrollattava) — sieltä voi lukea vanhempia viestejä, myös niitä jotka jäivät lukematta. Palkki itse ei vie korkeutta.
- Vasemmalla pulssaava LIVE-piste + "Live ticker" -teksti, sen vieressä **silmä/X-toggle**: piilottaa palkin kokonaan. Piilotettuna näkyy oikeassa alakulmassa pieni "Näytä live ticker (N uutta)" -nappi.
- Toggle-tila ja "viimeksi luettu -aikaleima" tallennetaan `localStorage`iin per kilpailu, jotta uudet vs. luetut erotellaan paluunkin jälkeen.
- Viestit eivät persistoidu reloadin yli (in-memory pino, max 50). Asetus säilyy.

## Viestilogiikka (kenttälajien kärkimuutokset)

Hook `useFieldLeaderChanges(details)`:
- Pitää refissä mapin `eventId → { leaderAllocId, leaderResult, secondResult }`.
- Käy `details` läpi jokaisella päivityksellä. Vain `EventCategory === "Field"`.
- Aktiivisen `Round`in `Allocations`ista lasketaan ResultRankin mukaan ykkönen ja kakkonen.
- Lähettää viestin kun:
  - ykkösen `AllocId` muuttuu (uusi kärki), tai
  - ykkönen pysyy mutta hänen tuloksensa paranee.
- Muoto: `"Siiri Aavikko (Lahden Ahkera) nousi T11 pituuden kärkeen: 5.42 m – ero 12 cm kakkoseen (Maija M.)"`. Eron muotoilu:
  - korkeus/seiväs: `cm` jos < 1 m, muuten `m`.
  - pituushypyt/heitot: `cm` jos < 1 m, muuten yksi desimaali metreinä.
- Ensimmäinen iteraatio talletetaan baselineksi hiljaa (ei viestiä).

## Komponentit ja tiedostot

**Uudet:**
- `src/lib/ticker-store.ts` — Reactiivinen pino: `useTickerStore()` palauttaa `{ messages, push, enabled, setEnabled, markRead, unreadCount }`. Toteutus: yksinkertainen module-level `useSyncExternalStore` ilman uusia paketteja.
- `src/hooks/useFieldLeaderChanges.ts` — kuten yllä; käyttää `ticker-store.push`ia.
- `src/components/announcer/LiveTicker.tsx` — visuaalinen palkki + ▲-paneeli + togglet + animaatiot (CSS).

**Muokataan:**
- `src/routes/announcer.combined.tsx`, `src/routes/announcer.live.tsx`, `src/routes/announcer.planning.tsx`:
  - kutsutaan `useFieldLeaderChanges(data.details)`,
  - lisätään `<LiveTicker />` `main`-osion ulkopuolelle,
  - lisätään `<main>`iin `pb-14` (vain kun ticker enabled — luetaan storesta).

## Rajaukset

- Vain kenttälajit. Juoksulajit ohitetaan.
- Vain announcer-routet — root-tason mountia, seurattavien live-seurantaa ja settings-togglea ei tehdä tässä iteraatiossa.
- Ei uusia npm-paketteja.
- Ei backend-muutoksia. Data tulee jo olemassa olevasta `useAnnouncerData().details`istä.

## Mitä ei muuteta

- `useAnnouncerData`-hookin ulostulo, `EventCard`, FLIP-animaatio, `RecordsBanner`, dataformaatit, RLS, migrations.