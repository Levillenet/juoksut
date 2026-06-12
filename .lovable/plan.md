## Suunnitelma: Poista "Kaikki"-vaihtoehto suorituspaikan livenäytöstä

### Tavoite
Kuuluttajanäkymän asetteluvalikon kohdasta **"Käynnissä-lajien näyttö → Tuloksia per laji"** poistetaan **Kaikki**-vaihtoehto. Jäljelle jäävät vain **Top 5** ja **Top 10**, koska enempää tuloksia ei mahdu suorituspaikan livenäytölle.

### Muutettavat tiedostot

**1. `src/lib/announcer-layout-store.ts`**
- `liveLimit`-tyyppi: `5 | 10 | "all"` → `5 | 10`
- `sanitizeView`: poista `"all"` validointiehdosta (vanhat tallennetut "all"-arvot palautuvat oletukseen 10)
- Päivitä oletukset tarvittaessa (planning-näkymän `liveLimit: 10` jo OK; combined-näkymän `liveLimit: 10` OK; live-näkymän `liveLimit: 5` OK)

**2. `src/components/announcer/AnnouncerLayoutControls.tsx`**
- Live-kontrollien nappilista: `([5, 10, "all"] as const)` → `([5, 10] as const)`
- Poista `n === "all" ? "Kaikki" : ...` -ehto, jätä vain `Top {n}`

**3. `src/components/announcer/InProgressSection.tsx`**
- `limit`-propin tyyppi: `5 | 10 | "all"` → `5 | 10`
- Oletusarvo: `"all"` → `10`

**4. `src/components/announcer/shared.tsx` (EventCard)**
- `rankLimit`-propin tyyppi: `5 | 10 | "all"` → `5 | 10`
- Oletusarvo: `"all"` → `10`
- Yksinkertaista `openList`: `allRanked.slice(0, rankLimit)` (poista `"all"`-haarat)

### Vaikutus
- Käyttäjille, joilla oli aiemmin "Kaikki" valittuna, valinta palautuu automaattisesti näkymän oletukseen (Top 5 tai Top 10).
- Mikään muu toiminta (sarakkeet, leveys, "Avaa kaikki oletuksena") ei muutu.