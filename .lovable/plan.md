## Diagnoosi

Tarkistin koodin ja Karstula-suunnitelman datan (`plan_events`).

**Pääsyy molempiin oireisiin: `planner-demo.ts` täyttää `override_duration_min`-kentän RPC:n palauttamasta `duration_min`-arvosta.**

```ts
// src/lib/planner-demo.ts:167
override_duration_min: s.duration_min > 5 ? s.duration_min : null,
```

RPC `get_competition_structure` laskee `duration_min = (max(captured_at) - min(captured_at))/60` eli **tuloksensyöttöikkunan**, ei lajin todellista kestoa. Tämä on sama tilastoharha, jonka `planner-estimate.ts:n` kommentti varoittaa välttämään.

Konkreettiset arvot Karstula-suunnitelmassa:
- `N15 Kuula` 16 osall. → override 8 min (pitäisi olla ~55 min)
- `P10 Kuula` 19 osall. → override 6 min
- `P8 Pituus` 29 osall. → override 8 min
- `T13 Kuula` 61 osall. → override 303 min (5 h)
- `P13 Kuula` 26 osall. → override 83 min
- `T11 Pituus` 81 osall. → override 38 min (liian lyhyt)

Tämän vuoksi VIRHE 2:n "T9 Pituus 8 min" syntyy: estimaattorin sääntö (`(7×1,2)/1 + 15 = 23 min`) on oikein, mutta `override_duration_min` ohittaa sen ennen kuin sääntö pääsee laskemaan.

**VIRHE 1 (sama laji kahdesti eri paikoilla, eri kellonajoilla):**
- `plan_events`-tauluissa EI ole duplikaattirivejä (varmistettu kyselyllä — cnt=1 kaikille pituus/korkeus/kuula-riveille tässä suunnitelmassa).
- Solver tuottaa **yhden** segmentin per laji. Kun `station_count = 2`, segmentti sijoitetaan kahdelle paikalle **samaan aikaikkunaan** (sama `starts_at`/`ends_at`) ja persistointi (rivit 1556–1565) tekee siitä kaksi `plan_schedule_items`-riviä — visuaalisesti kaksi RINNAKKAISTA palkkia, ei kahta peräkkäistä.
- Ainoa tapa, jolla "T7 Pituus" voi näkyä kahdella ERI aikavälillä, on että käyttäjä on Lajit-välilehdellä luonut sen kaksi kertaa, tai sama age_class esiintyy datassa kahdessa hieman eri muodossa (esim. `T7` vs `t7` -typo). Tarvitsen kuvankaappauksen tai tarkemman lajinimen vahvistaakseni — Karstulan nykydatassa ei ole T7-rivejä lainkaan.

## Korjaussuunnitelma

### Muutos 1: `src/lib/planner-demo.ts`
Poista `override_duration_min`-arvon asettaminen tuloksensyöttöikkunan kestosta. Jätä aina `null`, jolloin `estimateDuration` käyttää sääntöpohjaista YAG 2022 -kaavaa.

```ts
// rivi 167, korvataan:
override_duration_min: null,
```

Käyttäjä voi edelleen asettaa overriden manuaalisesti Lajit-välilehdellä (UI rivit 1149–1170) jos haluaa pakottaa tietyn keston.

### Muutos 2: Kertaluonteinen siivous nykyiselle Karstula-suunnitelmalle
Nollataan kaikki automaattisesti asetetut `override_duration_min`-arvot kyseisestä suunnitelmasta, jotta uudelleengenerointi käyttää oikeita sääntöpohjaisia kestoja:

```sql
UPDATE plan_events
SET override_duration_min = NULL
WHERE plan_id = 'c7f9ff68-2512-431e-8079-0e6ff9af69bb';
```

(Tarjotaan myös laajempi siivous kaikille olemassa oleville suunnitelmille jos käyttäjä haluaa.)

### Muutos 3: Sääntökaavojen tarkistus `planner-rules.ts`
Olemassa olevat kaavat näyttävät jo oikeilta:
- `jump_pit`: `(n × 1,2) / stations + 15` — vastaa käyttäjän pyytämää
- `shot_discus_hammer`: `25 + n × 1,5` (rajat 30–90)
- `javelin`: `30 + n × 1,7` (rajat 35–100)
- `high_jump`, `pole_vault`: omat kaavat

T9 Pituus 7 osall. → `(7 × 1,2)/1 + 15 = 23 min` ✓ (täsmää käyttäjän odotukseen).

**En muuta kaavoja**, koska ne ovat jo linjassa pyynnön kanssa. Jos halutaan minimi-kesto 15 min (nyt 5 min Math.max-rajoitus `planner-estimate.ts:73`), nostan sen 15:een — kerro jos haluat.

### Muutos 4: VIRHE 1:n jatkotutkimus
Generoinnin jälkeen ajetaan diagnostiikkakysely:

```sql
SELECT age_class, event_name, COUNT(*) FROM plan_events
WHERE plan_id = 'c7f9ff68-2512-431e-8079-0e6ff9af69bb'
GROUP BY age_class, event_name HAVING COUNT(*) > 1;
```

Jos duplikaatteja löytyy, poistetaan ne ja lisätään tarkistus `fillPlanFromCompetition`-funktioon: ryhmitellään `eventRows` `(age_class, event_name)`-parilla ennen insertiä.

Jos duplikaatteja EI löydy mutta käyttäjä näkee silti samat lajit Gantt-näkymässä kahdessa ajassa, syy on `station_count > 1` + Gantt-renderöinti (kaksi riviä = OK, jos ne ovat samalla aikavälillä). Lisätään Gantt-näkymään yhdistetty palkki (yksi rivi joka merkitsee "2 paikkaa käytössä") — mutta tämä on UI-muutos joka kannattaa tehdä vasta kun datapuoli on kunnossa.

### Toteutusjärjestys
1. Muokkaa `planner-demo.ts` (poista virheellinen override-asetus).
2. Siivoa `override_duration_min` nykyisestä Karstula-suunnitelmasta.
3. Käyttäjä painaa "Generoi aikataulu" -nappia Plannerissa.
4. Tarkistetaan tulos: duplikaattikysely + silmäilemällä Gantt.
5. Jos VIRHE 1 toistuu, jatketaan diagnoosia konkreettisella datalla.

### Mitä EI muuteta
- Solver (`planner-solver.ts`) — toimii oikein station_count-logiikan osalta.
- Lajisääntöjen kaavat (`planner-rules.ts`) — vastaavat YAG 2022 -dataa ja käyttäjän odotuksia.
- Gantt-näkymä, värit, konfliktit, sivupaneli — eivät liity tähän virheeseen.
