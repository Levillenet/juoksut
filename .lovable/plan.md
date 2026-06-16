## Tavoite
Koota kaikki kilpailutapahtuman generointiin ja aikataulutukseen liittyvä koodi yhteen tekstitiedostoon, jonka voit ladata ja analysoida erikseen.

## Mukaan otettavat tiedostot (~6 700 riviä)

**Säännöstö / generointilogiikka (`src/lib/`)**
- `planner-types.ts` (171)
- `planner-defaults.ts` (360) — lajien oletusasetukset
- `planner-rules.ts` (168) — sääntöjen määrittely
- `planner-timings.ts` (105) — ajoitukset
- `planner-estimate.ts` (80) — kestoarviot
- `planner-officials.ts` (142) — toimitsijat
- `planner-stadium.ts` (138) — stadionin resurssit
- `planner-solver.ts` (766) — ydinratkaisija
- `planner-demo.ts` (226) — demo-data
- `planner-schedule-pdf.ts` (159)
- `planner-schedule-xlsx.ts` (343)
- `event-durations.ts`, `event-specs.ts`, `event-name.ts`, `event-filters.ts` — lajimetatieto, jota solver käyttää

**Reitit (`src/routes/`)**
- `planner.tsx` (20)
- `planner.index.tsx` (245)
- `planner.$planId.tsx` (1999)
- `planner.$planId.gantt.tsx` (127)

**Komponentit (`src/components/planner/`)**
- `PlannerFullGantt.tsx` (1087)
- `ScheduleItemSheet.tsx` (539)

## Tuotos

Yksi tiedosto: `/mnt/documents/planner-bundle.txt`

Rakenne:
```
================================================================
FILE: src/lib/planner-types.ts
================================================================
<sisältö>

================================================================
FILE: src/lib/planner-defaults.ts
================================================================
...
```

Alkuun lisätään sisällysluettelo ja kunkin tiedoston rivimäärä, jotta navigointi on helppoa.

## Toteutus

Build-tilassa:
1. Tarkistetaan että jokainen lueteltu tiedosto on olemassa (skipataan puuttuvat).
2. Bash-skripti yhdistää tiedostot otsikoineen `/mnt/documents/planner-bundle.txt`-tiedostoon.
3. Toimitetaan `<presentation-artifact>` -linkki latausta varten.

Mitään olemassa olevaa koodia ei muuteta — tämä on pelkkä koonti luettavaksi.