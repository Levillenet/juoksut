## Kestolaskennan kalibrointi YAG 2022 -dataa vasten

Vain `src/lib/planner-rules.ts`. Solver-korjaukset (VAIHE A–C) jäävät koskemattomiksi.

### KORJAUS 1 — Pitkät matkat

`minutesPerHeat`:
```ts
if (d >= 3000) return 18;
if (d >= 1500) return 10;
if (d >= 1000) return 8;
```

`defaultHeatSize`:
```ts
if (d != null && d >= 3000) return 30;
if (d != null && d >= 1500) return 20;
if (d != null && d >= 1000) return 16;
return 8;
```

### KORJAUS 2 — Aitajuoksut

`defaultHeatSize` alkuun:
```ts
if (isHurdles(eventName)) return 16;
```
(palauttaa ennen matkapohjaista logiikkaa)

### KORJAUS 3 — Pituushyppy isoilla porukoilla

`jump_pit`-haara: valitaan käyttäjän ehdotuksista **kasvava valmistelu**:
```ts
const valm = 15 + Math.max(0, n - 30) * 0.3;
const raw = (n * 1.2) / stations + valm;
```
Kaava-string päivitetään vastaavasti.

### KORJAUS 4 — Korkeushyppy

`high_jump`-haara: per_osall-kerroin 2 → 1.2 (käyttäjän vertailussa lähempänä todellisuutta keskimäärin):
```ts
const raw = 60 + Math.max(0, n - 10) * 1.2;
```
Rajat 45–150 säilyvät. Kaava-string päivitetään.

### Mitä EI muuteta

- `minutesPerHeat`-kaavat lyhyille matkoille (40–800 m), aidat-perusarvo 6 min
- `parseTrackDistanceM`, `isHurdles`, `isWalk`, `isTrackEventName`, `classifyEvent`
- Heittolajit (kuula/kiekko/keihäs/moukari), pole_vault, jump_pit-rinnakkaiskerroin 1.2 (vain valmistelu kasvaa)
- Solveri (planner-solver.ts) — koskemattomana

### Testaus

Käyttäjä ajaa "Generoi aikataulu" YAG (kopio):lle ja vertaa odotettuihin lukuihin:
- 1000m T13 ≈ 30 min
- 60m aidat T11 ≈ 24 min
- Pituus T13 (78 osall., 2 paikkaa) ≈ 80–90 min
- Korkeus T11 (30 osall.) ≈ 80 min
