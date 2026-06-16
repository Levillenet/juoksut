## A) Keihäs–häkki-rinnakkaisuus

### Migraatio (jo ajettu)
- `stadium_venues.next_to_throw_cage boolean NOT NULL DEFAULT true`
- `plan_venues.next_to_throw_cage boolean NOT NULL DEFAULT true`

### Tyypit
- `src/lib/planner-types.ts`: lisää `next_to_throw_cage: boolean` `VenueRow`- ja `StadiumVenueRow`-tyyppeihin.

### Solver (`src/lib/planner-solver.ts`)
Solven alussa rakenna implisiittinen konfliktiryhmä:
- `cageIds = usableVenues.filter(v => v.kind === 'throw_cage').map(v => v.id)`
- `blockedRunwayIds = usableVenues.filter(v => v.kind === 'throw_runway' && v.next_to_throw_cage).map(v => v.id)`
- Jos molempia on ≥1, lisää `conflictGroups`-listaan `{ venue_ids: [...cageIds, ...blockedRunwayIds], max_concurrent: 1 }`.

Tämä lukitsee kiekko/moukari/keihäs keskenään. Jos käyttäjä lisää toisen keihäspaikan ja merkitsee sen `next_to_throw_cage = false`, kyseinen paikka jää konfliktiryhmän ulkopuolelle ja voi toimia rinnakkain.

### Stadium → plan -kopiointi (`src/lib/planner-stadium.ts`)
Kopioi `next_to_throw_cage` mukaan kun stadion-paikkoja kopioidaan plan-paikoiksi.

### Stadium-editori (`src/routes/stadiums.$stadiumId.tsx`)
Jokaisen `throw_runway`-rivin kohdalle pieni checkbox/toggle:
"Moukarihäkin vieressä" (oletus). Selitys tooltipissä/info-tekstissä.

### Plan-editori (`src/routes/planner.$planId.tsx`, Suorituspaikat-välilehti)
Sama checkbox `throw_runway`-paikoille (jotta voi yliajaa stadion-mallin arvon yksittäisessä kisassa).

## B) "Hallinnoi stadioneja" -linkin kaatuminen

Nykyinen `<a href="/stadiums" target="_blank" rel="noreferrer">` -anchor aukaisee uuden välilehden, joka SSR-renderöityy kylmänä Lovable-previewssä ja kaatuu (`Cannot read properties of null (reading 'useContext')`).

Korvataan TanStack-Linkillä (rivi 443 tienoilla):
```tsx
<Link to="/stadiums" className="...">Hallinnoi stadioneja →</Link>
```
Reititys tapahtuu client-side; AuthProvider on jo paikalla, ei kaatumista.

## Toteutusjärjestys
1. Tyypit (`planner-types.ts`)
2. Stadium-kopiointi (`planner-stadium.ts`)
3. Solver-konfliktiryhmä (`planner-solver.ts`)
4. Stadium-editori UI
5. Plan-editori UI
6. Linkin korjaus
