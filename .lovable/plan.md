## Diagnoosi tilanteesta day_windows-laajennuksen jälkeen

Varoituslista paljastaa kaksi asiaa:

1. **"X heats / final / single – ei mahdu mihinkään sallittuun päivään"** (~85 kpl) — solveri ei saa sijoitettua lajia mihinkään päivään, koska ratapaikat ja kenttäpaikat (1 per kind) saturoituvat ennen kuin sarja ehtii vuoroon. Sama syy mitä raportissa ennustettiin: kapasiteettia per venue-kind on liian vähän.
2. **"P8 40m final_b: tauko 781 min (max 2 min)"** — ASIA 1 -tarkistus toimii oikein. Final_b sijoittui eri päivälle kuin final_a → 13 h tauko. Tämä on diagnostinen varoitus, ei estä sijoittumista; korjataan kun rinnakkaiset paikat lisätty.

Day_windows-laajennus toi +7 h kapasiteettia, mutta pullonkaula on edelleen per-kind: 1 shot_ring, 1 throw_cage, 1 throw_runway, 1 high_jump, 1 pole_vault, 1 track_oval, 1 track_straight. Real YAG käyttää 2–3 per kind.

Lisäksi varoitusteksti `${seg.ageClass} ${seg.phase}` ei sisällä lajinimeä → vaikea selvittää mistä lajista on kyse (esim. "M15 single" toistuu 8 kertaa eri lajeille).

## Suunnitelma — askel B + pieni QoL-korjaus

### B1. Lisää puuttuvat rinnakkaiset suorituspaikat YAG (kopio) -suunnitelmaan

Lisätään `plan_venues`-tauluun (vain tähän plan_id:hen) seuraavat paikat. Kaikki `included = true`, ei `stadium_venue_id` (irralliset):

| name | kind | peruste |
|---|---|---|
| Kuulakehä L | shot_ring | oikeassa YAG: K + L |
| Korkeushyppy E | high_jump | oikeassa YAG: D + E |
| Seiväshyppy F | pole_vault | oikeassa YAG: F + G |
| Keihäs J2 takakaarre | throw_runway | oikeassa YAG: J1 + J2 + ulko |
| Keihäs ulkoheittopaikka | throw_runway | sama |
| Ulkoheittopaikka (kiekko/moukari) | throw_cage | oikeassa YAG: I etukaarre + ulko |
| Etusuora | track_straight | erotetaan ES + TS (nyt vain 1 "Pikajuoksusuora") |
| Takasuora | track_straight | sama |

→ Nimetään olemassa oleva "Pikajuoksusuora" uudelleen "Etusuora", ja lisätään "Takasuora". Tai vaihtoehtoisesti pidetään vanha ja lisätään 1 uusi. Valitaan: **lisätään `Takasuora`, ei muuteta vanhaa**, jotta säilytetään olemassa olevien `plan_schedule_items.venue_ids`-viitteiden eheys (jos niitä on jo tallennettuna edellisistä ajoista).

Yhteensä 8 INSERT-riviä. Tehdään yhdellä INSERT-statementilla. Ei koodimuutoksia, ei skeemamuutoksia.

**Vaikutusarvio**: per-kind kapasiteetti tuplaantuu/triplaantuu pullonkaulalajeissa. Arvio: "ei mahdu" -varoitukset 85 → 10–20.

### B2. Paranna "ei mahdu" -varoitusta sisältämään lajinimi

Pieni koodikorjaus `src/lib/planner-solver.ts` riville 385–387:

```ts
warnings.push(
  `${seg.ageClass} ${seg.eventName} ${seg.phase} – ei mahdu mihinkään sallittuun päivään.`,
);
```

Vain string-konkatenaatio, ei logiikkamuutosta. Helpottaa diagnostiikkaa kun käymme jäljelle jääviä varoituksia läpi.

### Mitä EI tehdä

- Ei muuteta solveria muuten — algoritmi toimii oikein, ongelma on edelleen datapula.
- Ei kosketa planner-rules.ts -kestolaskentaan.
- Ei muuteta muita suunnitelmia tai pohjadataa.
- Ei lisätä `lanes`-konseptia track-venueille tässä vaiheessa (askel C, vain jos B ei riitä).

### Testaus

1. Aja UPDATE/INSERT
2. Käyttäjä ajaa YAG (kopio) -generoinnin uudelleen
3. Raportoi:
   - "ei mahdu" -varoitusten määrä (oli 85, tavoite < 20)
   - "tauko edellisestä vaiheesta" -varoitusten määrä
   - Sijoittumattomien plan_eventien määrä

Jos jää vielä isoja puutteita → askel C (track_oval lanes tai track_straight kahdesti).
