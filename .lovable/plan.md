# PDF-aikataulun tulostus suunnittelijaan

Lisätään "Tulosta PDF" -painike aikataulu-välilehdelle (nykyisen "Vie Excel" -painikkeen viereen). PDF on tekstimuotoinen, päivittäin jaoteltu, kellonajoittain järjestetty taulukko — samaan tapaan kuin nykyiset `print/*`-sivut, mutta tuotetaan suoraan `jsPDF + jspdf-autotable` -kirjastoilla (jo käytössä `src/lib/yag-calling-pdf.ts`:ssä).

## Sisältö per päivä

Otsikko: `Päivän nimi DD.MM.YYYY` (Pe/La/Su 12.6.2026 …).

Taulukon sarakkeet:

| Aika | Suorituspaikka | Ikäluokka | Laji | Erät | Osallistujat | Huom |

Rivit järjestetty `starts_at` mukaan nousevasti. `Aika` = `HH:mm–HH:mm`. `Erät` näkyy radalla (esim. `3 erää × 5 min`), kentällä tyhjä. `Huom` näyttää konfliktimerkinnän jos rivi on konfliktissa (`!`).

Alaotsikkona kunkin päivän alla: tila, jossa lukee yhteenveto `N lajia, kesto HH:mm–HH:mm`.

## UI

`PlannerSchedule`-komponentissa (`src/routes/planner.$planId.tsx`, rivi ~1059) `exportExcel`-napin viereen:

```tsx
<Button variant="secondary" onClick={exportPdf} disabled={schedule.length === 0}>
  Tulosta PDF
</Button>
```

A4 landscape, marginaalit 8 mm, fontti 9 pt — kuten `yag-calling-pdf.ts`. Tiedostonimi `aikataulu-{plan.name slug}-{YYYY-MM-DD}.pdf`.

## Toteutus

Uusi tiedosto: **`src/lib/planner-schedule-pdf.ts`** — funktio `downloadPlannerSchedulePdf({plan, venues, events, schedule, conflicts})`:
- Ryhmittelee `schedule` rivit päivän mukaan (käyttää `resolveDayWindows(plan)`).
- Jokaiselle päivälle `autoTable` yo. sarakkeilla.
- Hakee `event.name`/`age_class`/`participants` `events`-listasta `plan_event_id`:n perusteella, `venue.name` `venues`-listasta.
- Radan erämäärä: `Math.ceil(participants / 8)` × `minutesPerHeatMin` (käyttäen `defaultMinutesPerHeat` jos `between_heats_min` puuttuu, kuten solver tekee).

Muokattava tiedosto: **`src/routes/planner.$planId.tsx`** — lisätään `exportPdf`-handler ja painike `PlannerSchedule`-osioon.

## Mitä EI tehdä

- Ei muuteta nykyistä Excel-vientiä, gantt-näkymää eikä solveria.
- Ei lisätä uutta reittiä — PDF generoidaan suoraan selaimessa kuten YAG-calling.
- Ei muuteta DB-skeemaa.
