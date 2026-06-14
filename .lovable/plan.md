
## Tavoite

Aikataulun tarkkuus paranee, kun otetaan huomioon lajikohtaiset valmistelu- ja siirtymäajat sekä aitajuoksujen looginen ryhmittely sileiden juoksujen kanssa.

## Mitä lisätään

### 1) Lajikohtaiset aika-asetukset (plan_events)

Uudet kentät jokaiselle suunnitelmalajille (oletukset suluissa):

- **`setup_before_min`** — aika ennen lajin alkua suorituspaikalla (esim. askelmerkit pituus/kolmiloikka/seiväs/korkeus). Oletukset:
  - Pituus / kolmiloikka: 10 min
  - Korkeus: 15 min (alkukorkeuden asettelu + lämmittelyhypyt)
  - Seiväs: 20 min (telineet, riman säätö)
  - Muut tekniset / juoksu: 0 min
- **`between_heats_min`** — juoksuerien välinen järjestäytymisaika (oletus 4 min pikajuoksuille, 6 min keskimatkoille).
- **`hurdle_setup_min`** — aitojen tuonti ja asettelu ennen ensimmäistä erää (oletus 10 min, vain aitalajit).
- **`hurdle_teardown_min`** — aitojen poisvienti viimeisen erän jälkeen (oletus 8 min).

Kaikki kentät ovat ylikirjoitettavissa lajikohtaisesti UI:ssa, mutta lajityypille ehdotetaan järkevä oletus automaattisesti (samalla logiikalla kuin nykyiset kestoarviot).

### 2) Suunnitelmatason oletukset (competition_plans)

Lisätään oletukset, jotka periytyvät uusille lajeille:

- `default_setup_field_min` (10)
- `default_between_heats_min` (4)
- `default_hurdle_setup_min` (10)
- `default_hurdle_teardown_min` (8)

Käyttäjä voi muuttaa oletukset planin alkuasetuksissa.

### 3) Aitajuoksujen ryhmittely

Solveriin sääntö: kun samalla radalla / suorituspaikalla on sekä aita- että sileitä juoksuja, ne **eivät vuorottele**.

- Aitalajit niputetaan yhteen blokkiin per suorituspaikka.
- Blokin alkuun lisätään `hurdle_setup_min`, loppuun `hurdle_teardown_min`.
- Eri aitakorkeudet (esim. P15 / T17) saa edelleen niputtaa peräkkäin jos sama radan layout käy; muuten lisätään uudelleen setup-aika.
- Käyttäjä voi pakottaa järjestyksen manuaalisesti raahaamalla kalenterissa; konflikti­varoitus syttyy jos aitablokki rikotaan sileällä juoksulla.

### 4) Aikataulun rakentaminen

Solverin uusi laskentakaava per segmentti:

```
segment_start = previous_end + recovery
visible_block_start = segment_start − setup_before_min
heat_total = base_per_heat × heats + (heats − 1) × between_heats_min
hurdle_extra = hurdle_setup_min (vain blokin 1. aita)
              + hurdle_teardown_min (vain blokin viim. aita)
segment_end = segment_start + heat_total + hurdle_extra
```

Kalenterissa setup-aika näkyy lajipalkin edessä haalealla värillä ("Valmistelu 10 min"), itse kilpailu täydellä värillä — käyttäjä näkee selvästi mihin aikaan suorituspaikka varautuu vs. kilpailu alkaa.

### 5) UI-muutokset

- **PlanEventTable**: uusi kolumniryhmä "Aika-asetukset" (setup / heats-väli / aitojen setup+teardown). Aitalajeissa aitakentät näkyvät, muissa piilossa.
- **Lajimuokkausdialogi**: selittävät tooltipit ja "Palauta oletus" -nappi.
- **Plan-asetusvälilehti**: "Aika-asetusten oletukset" -lohko.
- **PlannerCalendar**: setup-vaihe omana vaaleampana segmenttinä, aitablokit merkitty pienellä aita-ikonilla, varoitus jos aitablokki katkeaa.

### 6) Excel-vienti

Vientiin lisätään sarakkeet: "Valmistelu alkaa", "Kilpailu alkaa", "Kilpailu päättyy", "Aitojen setup (min)", "Eräväli (min)" — jotta järjestäjä näkee mistä koko­naisaika koostuu.

## Tekninen toteutus

1. **Migraatio**: ALTER TABLE `plan_events` ja `competition_plans` (uudet sarakkeet, oletukset, NOT NULL + DEFAULT).
2. **`src/lib/planner-types.ts`**: laajennetut tyypit.
3. **`src/lib/planner-estimate.ts`**: `suggestEventTimings(eventKey, ageClass)` palauttaa setup/heats-välin oletukset lajityypin perusteella (uudelleenkäyttää `event_spec_suffix`-logiikkaa aitojen tunnistamiseen).
4. **`src/lib/planner-solver.ts`**: 
   - Segmenttilaskuun setup + between-heats.
   - Aitablokkien rakennus: ryhmittele aitalajit per venue, järjestä ensin, lisää setup/teardown.
   - Konfliktitarkistus: jos käyttäjä raahaa sileän juoksun aitablokin keskelle → punainen varoitus.
5. **`PlanEventTable.tsx`** + **lajidialogi**: uudet kentät, oletusten ehdotus auto-täytöllä, "palauta oletus".
6. **`PlannerCalendar.tsx`**: setup-segmentti visualisointi + aitablokin varoitus.
7. **Excel-vienti** (`src/lib/planner-export.ts`): uudet sarakkeet.

## Mitä EI tehdä tässä vaiheessa

- Ei monivaiheista palautumisaikaa per kilpailija (vain järjestäytymisaika).
- Ei automaattista aitakorkeuksien yhteensopivuuden päättelyä — käyttäjä voi pakottaa erottelun manuaalisesti.
- Ei mobiilioptimointia kalenterin uusille elementeille (sama kuin nykytila).
