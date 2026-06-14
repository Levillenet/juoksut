## VAIHE A — KORJAUS 1 (sort) + KORJAUS 4 (kesto)

Toteutetaan vain nämä kaksi muutosta. Testataan, ennen kuin siirrytään vaiheisiin B–D.

### Tiedosto: `src/lib/planner-solver.ts`

**Muutos 1: heats-segmentin kesto (rivi 136)**

Nykyinen:
```ts
durationMin: Math.max(5, ev.estimateMinutes - (ev.finalAMin ?? 0) - (ev.finalBMin ?? 0)),
```

Uusi:
```ts
// estimateMinutes = alkuerien kesto (computeRuleEstimate palauttaa heats × perHeat).
// A/B-finaalit ovat omat segmentit, niiden kestoja ei vähennetä heatsista.
durationMin: Math.max(5, ev.estimateMinutes),
```

Tämä korjaa sen, että 60m aidat -heats sai aikaisemmin `max(5, 18 − 8 − 8) = 5 min` vaikka oikea kesto on 18 min (3 erää × 6 min).

**Muutos 2: vaihejärjestys segmenttien sortissa (rivi 176)**

Lisätään `phaseOrder`-apuri ja muokataan vertailua:
```ts
const phaseOrder = (p: SchedulePhase): number =>
  p === "heats" ? 0 : p === "final_a" ? 1 : p === "final_b" ? 2 : 0;

segments.sort((a, b) => {
  // Saman eventin vaiheet aina järjestyksessä heats → final_a → final_b
  if (a.eventId === b.eventId) return phaseOrder(a.phase) - phaseOrder(b.phase);
  if (a.groupKey !== b.groupKey) return a.groupKey.localeCompare(b.groupKey);
  return b.durationMin * b.needsStations - a.durationMin * a.needsStations;
});
```

Tämä takaa, että saman eventin heats käsitellään ennen final_a:ta, jolloin `eventEnds.get(heatsId)` on jo asetettu kun finaalin `prevEventEnd` lasketaan → palautusaika ja vaihejärjestys toimivat.

### Testaus VAIHE A:n jälkeen

1. Avataan YAG (kopio) -kilpailu (`/planner/c7f9ff68-…`)
2. Klikataan "Generoi aikataulu" → vahvistetaan
3. Raportoidaan:
   - Konfliktien määrä (oli 33)
   - "Ei mahdu mihinkään sallittuun päivään" -warningien määrä (oli > 100)
   - T11 60m aidat (TS) vaiheiden ajat ja kestot tietokannasta

Odotettu tulos: heats-vaiheet ovat aina ENNEN final_a/final_b:tä. Heats-kesto on noin 18 min (3 erää × 6 min) entisen 5 min sijaan. Konflikteja todennäköisesti vähemmän, koska "finaali ennen alkueriä" -tilanteet poistuvat.

Jos jokin uusi bug ilmenee → pysäytetään ja raportoidaan ennen VAIHE B:tä.
