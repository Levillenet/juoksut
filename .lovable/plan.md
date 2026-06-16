## Korjaus: "Sama ikäryhmä päällekkäin" → varoitus, ei kriittinen

Yksi muutos `src/lib/planner-solver.ts` riveille 638–643:

```ts
out.push({
  id: arr[i].id,
  severity: "warning",
  relatedIds: [arr[i - 1].id],
  reason: `Saman ikäryhmän ${age} eri lajit päällekkäin – tarkista että urheilijat eivät osallistu molempiin`,
});
```

## Mitä EI muuteta

- Track-lukitus-konfliktit (Rata + Suora) säilyvät kriittisinä.
- Solverin sijoituslogiikka muuten ennallaan.
- Ovaalin kapasiteettiongelmat (21 puuttuvaa pitkää lajia) jäävät tähän kierrokseen — käyttäjä päättää seuraavasta vaiheesta (A: manuaalinen allowed_days, B: round-robin solverissa, C: parempi diagnoosi).

## Validointi

1. Aja YAG (kopio) -generointi uudestaan.
2. Raportoi: paljonko critical vs warning -konflikteja jää.
