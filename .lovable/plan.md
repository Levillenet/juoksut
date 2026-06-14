## Diagnoosi

T7 Pituus näkyy Karstula-suunnitelmassa 3 kertaa, vaikka `plan_events`-taulussa on vain yksi rivi. Tietokannassa on 3 `plan_schedule_items`-riviä samalle `plan_event_id`:lle:

| starts_at | venue | auto_generated |
|---|---|---|
| 14:37 | Pituuskuoppa A | false (manuaalinen) |
| 14:52 | Pituuskuoppa B | true |
| 14:57 | Pituuskuoppa B | false (manuaalinen) |

**Syy**: `planner.$planId.tsx:1551–1555` generointi-handler poistaa vain `auto_generated=true`-rivit. Heti kun käyttäjä raahaa palkkia Gantt-näkymässä, rivin lippu kääntyy `false`, ja se jää eloon yli seuraavien generointien — kun solver luo uuden auto-rivin samalle lajille, syntyy duplikaatti. Sama selittää P5 Pituuden duplikaatin samalla paikalla.

## Korjaus

### Muutos 1: `src/routes/planner.$planId.tsx` (generointi-handler, rivi ~1551)

Poista **kaikki** suunnitelman `plan_schedule_items`-rivit ennen uutta generointia:

```ts
await supabase
  .from("plan_schedule_items")
  .delete()
  .eq("plan_id", plan.id);
// (poistettu .eq("auto_generated", true) -rajaus)
```

### Muutos 2: Selvä varoitus käyttäjälle

"Generoi aikataulu" -napin viereen lyhyt huomautusteksti:

> Generointi poistaa kaikki aiemmat aikataulurivit (myös manuaaliset muokkaukset) ja luo aikataulun tyhjästä.

Tämä estää käyttäjää menettämästä työtään vahingossa.

### Muutos 3: Nykyisten duplikaattien siivous

Karstula-suunnitelman nykyiset duplikaatit poistetaan kertasiivouksena: poistetaan kaikki `plan_schedule_items` plan_id `9d3a297f-4e0f-45d0-8caf-e4555bfc19ea` -suunnitelmasta. Käyttäjä painaa sen jälkeen "Generoi aikataulu" niin saa puhtaan tuloksen.

## Mitä EI muuteta

- Solver-logiikka (toimii oikein — yksi segmentti per laji).
- `auto_generated`-kentän rakenne ja muut käyttäjäpolut (PDF/XLSX-export jne).
- Lajisääntöjen kaavat.
