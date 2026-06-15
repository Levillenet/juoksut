## Diagnoosi: miksi 80 varoitusta jää venue-lisäysten jälkeenkin

Tarkistin tietokannan, solverin ja datan. Venue-lisäys oli tarpeen, mutta varoitukset eivät vähene, koska **kaksi muuta juurta** estävät sijoittelun. Ne on hoidettava ennen kuin lisäpaikkojen vaikutus näkyy.

### Juurisyy 1 — 800 m on virheellisesti `final_format = a_b` (DATA)

Selittää 19/80 varoituksesta (kaikki `800m final_a` ja `final_b` rivit, lisäksi `T9 800m kävely`).

Todellisessa YAG 2026:ssa 800 m juostaan suorana (yksi tai useampi tasaerä), ei A/B-finaalimallilla. Nyt jokaiselle 800 m -lajille luodaan `heats + final_a + final_b` -segmentit. Ovaali on yksi rata → 11 ikäluokan heats syövät päivän, ja final_a/final_b -segmenteille ei jää tilaa.

Korjaus on pelkkä datapäivitys:
```sql
UPDATE plan_events
  SET final_format = 'direct'
  WHERE plan_id = '<plan>'
    AND (event_name ILIKE '%800m%' OR event_name ILIKE '%800 m%' OR event_name ILIKE '%2000m kävely%');
```
(Tarkista vielä erikseen onko `4x600m viesti` ja muut kestävyysjuoksut myös virheellisesti `a_b` — jos ovat, sama korjaus niihin.)

### Juurisyy 2 — `ageBusyUntil` pakottaa kaikki saman ikäluokan lajit peräkkäin (SOLVER)

Selittää loput ~61 varoitusta (kaikki kentälajien `single` -rivit).

Solverissä jokainen ikäluokka saa yhden globaalin "varattu kunnes" -aikaleiman (`ageStates.busyUntil`). Lajit järjestetään `groupKey`-mukaan: ensin aidat (AAA), sitten juoksut (BBB), viimeisenä kenttälajit (CCC singlet). Käytännössä T13/T11/T14 yms. saavat ensin pituutta `ageBusyUntil`-arvolle radoista (60m, 60m aidat, 200m, 800m, viestit), ja `ageBusyUntil` voi siirtyä jo päivän 3 iltapäivään. Sen jälkeen ko. ikäluokan kentälajisinglet (Korkeus, Pituus, Kuula, Kiekko, Keihäs, Seiväs, Moukari, Kolmiloikka) eivät enää löydä mistään päivästä tilaa vaikka venue olisi vapaa — eli "ei mahdu mihinkään sallittuun päivään".

Tämä ei vastaa todellisuutta: oikeassa YAG:ssa saman ikäluokan korkeushyppy ja juoksu ovat usein **samaan aikaan**, koska eri urheilijat osallistuvat eri lajeihin. `ageBusyUntil`-rajoitus on liian kova.

Tarkistus: T13 14 lajia, joiden summakesto ~17 h. Mahtuisi hyvin 3 päivän 32 h ikkunaan, jos rinnakkaisuus radan ja kentän välillä sallitaan. Nyt summa peräkkäin täyttää päivän 3 lopun, ja viimeiset singlet hylätään.

### Korjausehdotus (yksi pieni koodimuutos)

`src/lib/planner-solver.ts`:n `ageStates`-logiikka muutetaan niin, että saman ikäluokan **rata- ja kenttälaji saavat olla rinnakkain**, mutta kaksi rataa tai kaksi kenttää eivät:

- Pidetään kaksi erillistä `busyUntil`-tilaa per ikäluokka: `track` ja `field` (luokitus `isRunningEvent(eventName)`:lla, joka on jo tiedostossa).
- Segmentin sijoittelussa `ageBusyUntil` luetaan oikeasta "raidasta": juoksulla rata-busyUntil, kentällä field-busyUntil.
- Päivittäminen `ageStates.set(...)` -kohdassa kohdistuu samaan raitaan.

Tämä säilyttää reaaliset rajoitukset (kaksi 60m-erää eivät kohtaa T13:lla yhtä aikaa) mutta vapauttaa kentälajit jonosta. Toinen vaihtoehto olisi sallia `N` rinnakkaista lajia per ikäluokka konfiguroitavasti — vähemmän tarkka, mutta yksinkertaisempi.

Sortin järjestys voidaan jättää ennalleen — ratoja kannattaa silti sijoittaa ensin.

### Vaiheittainen toteutus

1. **DATA**: päivitä 800 m -tapahtumat `final_format = 'direct'`. Aja generaattori. Odotettu vaikutus: 19 → 0 800m-varoitusta, mutta ~61 single-varoitusta jää.
2. **KOODI**: jaa `ageStates` `track`/`field`-raitoihin solverissa. Aja generaattori uudestaan. Odotettu vaikutus: ~61 → 0–5 single-varoitusta.
3. **RAPORTOI**: jäljellä olevien varoitusten määrä ja luettelo, sekä otos sijoittelusta (T13 60m + Korkeus + Pituus + Kuula).

### Mitä ei tehdä

- Ei lisätä uusia venueja (nykyiset riittävät kun ageStates-rajoitus löystyy).
- Ei muuteta `planner-rules.ts`:n kestolaskentaa eikä konfliktiryhmiä.
- Ei kosketa muiden ikäluokkien `allowed_days`-arvoja.

Kun hyväksyt, aloitan kohdasta 1.
