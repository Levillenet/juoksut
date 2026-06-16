## Bugi: VenueState.busyUntil ei resetoidu päivien välillä

Vahvistettu lukemalla `src/lib/planner-solver.ts` rivit 280–450:

- Rivi 289: `for (const v of venueStates) v.busyUntil = input.windows[0].startMs;` — alustus vain ensimmäisen päivän alkuun.
- Rivi 364: `for (const win of input.windows) { ... }` — päiväiteraatio ei resetoi paikkojen tilaa.
- Rivi 381: `freeAt(vs) = vs.busyUntil + venueChangeoverMs(vs)` — kun edellinen sijoitus jätti `busyUntil`-arvon edellisen päivän puolelle (esim. klo 20:00), ei mikään paikka näytä vapautuvan ennen nykyisen päivän loppua → `ready` jää tyhjäksi → "vapaata 0 min".

Sama koskee `ageStates`-rakennetta.

## Korjaus

Yksi muutos `src/lib/planner-solver.ts`:n riveille 364–368: lisätään `for (const win of input.windows)`:n alkuun resetointi, joka työntää menneen päivän puolelle jääneet `busyUntil`-aikaleimat tämän päivän alkuun.

```ts
for (const win of input.windows) {
  // KORJAUS: päivärajan ylittävä busyUntil ei saa estää uutta päivää.
  for (const v of venueStates) {
    if (v.busyUntil < win.startMs) {
      v.busyUntil = win.startMs;
      v.lastEventName = null;   // aidat ja matkanvaihtoaika eivät kanna yötä yli
      v.lastWasHurdle = false;
    }
  }
  for (const [ac, state] of ageStates) {
    if (state.busyUntil < win.startMs) {
      ageStates.set(ac, { busyUntil: win.startMs });
    }
  }

  if (seg.allowedDays && !seg.allowedDays.has(win.date)) {
    failReasons.push(`${win.date}: päivärajoitus sulkee pois`);
    continue;
  }
  // ... olemassaoleva logiikka jatkuu muuttumattomana
}
```

## Mitä EI muuteta

- `eventEnds`, `phaseEnds`, `phaseVenues` — vaihejärjestys (alkuerät → finaali) kantaa päivien yli.
- `ovalBusy`, `straightBusy`, `groupBusy` — kaikkien päivien yli, päiväraja jo huomioitu `win.startMs/endMs`-tarkistuksissa.
- Solverin muu logiikka, venuejen rakenne, segmenttien generointi.

## Validointi

1. Aja YAG (kopio) -generointi uudestaan.
2. Raportoi: kuinka monta lajia jää `ei mahdu` -varoituksella?
3. Tarkista että pitkät juoksut ja kenttälajeja jakautuvat eri päiville.
4. Jos vielä jää ~5–15 todellista kapasiteettiongelmaa, päätetään tarvitaanko VAIHE 2 (`allowed_days`-jako oikean YAG:n mallin mukaan).
