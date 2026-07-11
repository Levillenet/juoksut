## Ongelma

Nykyinen valvonta ja `/admin/tuloslista-probe` testaavat vain kilpailulista-endpointtia (`cached-public-api.tuloslista.com/live/v1/competition`). Se palauttaa 200 OK jopa nyt, koska välimuisti (`x-cache-status: HIT`) tarjoilee vanhaa kopiota. **Data ei silti valu sisään** koska harvesteri kysyy toista endpointtia — yksittäisen kilpailun tulokset — ja siihen esto (tai muu vika) on edelleen päällä: viimeisin todellinen tulostallennus oli 2026-07-09 20:46 UTC, ja kaikki tämän jälkeiset skannaukset ovat palauttaneet tyhjän.

Valvonta antaa siis väärän vihreän valon.

## Ratkaisu

Laajenna valvontaa mittaamaan **molemmat endpointit**, ja käytä results-endpointin tulosta harvesterin auto-eston signaalina.

### 1. Probe-funktio: kaksi tarkistusta

Kutakin monitor-ajoa kohti tehdään kaksi kyselyä samalla harvester-User-Agentilla:

- **A. Lista** (nykyinen): `cached-public-api.tuloslista.com/live/v1/competition`. Kertoo onko listaväylä auki.
- **B. Tulokset** (uusi): valitaan tietokannasta viimeisin `harvest_competitions`-rivi jolla `exists_in_source=true` ja tuoreehko `competition_date`, ja kysytään sen tuloksia samasta origin-hostista josta harvesteri niitä hakee. Onnistumiskriteeri: HTTP 200, JSON, kohtuullinen tavu- tai rivimäärä.

Jos DB:ssä ei ole sopivaa viitekilpailua, käytetään yhtä kovakoodattua tunnettua kilpailu-ID:tä varaparina.

### 2. Loki: erottele endpointit

Lisätään `tuloslista_probe_log`-tauluun sarake `endpoint` (`list` / `results`) ja tallennetaan molemmat rivit joka ajolla. UI näyttää molemmat sarakkeet omissa taulukoissaan / erillisillä tilakorteilla.

### 3. Auto-esto perustuu results-endpointtiin

`harvest_state.blocked` päälle silloin kun **results-probe** epäonnistuu peräkkäin (esim. 2 kertaa peräkkäin ei-200 / tyhjä / verkkovirhe). Lista-proben epäonnistuminen näytetään UI:ssa, mutta se ei yksin katkaise harvesteria (koska välimuisti voi palauttaa vanhaa dataa tai lista voi olla kunnossa vaikka results olisi rikki).

Auto-purku kun results-probe onnistuu.

### 4. UI-muutokset `/admin/tuloslista-probe`

- Kaksi tilakorttia rinnakkain: "Kilpailulista" ja "Kilpailun tulokset" (kumpikin: vihreä/punainen, viimeisin status, kesto, tavut, `x-cache-status`).
- "Tarkista nyt" ajaa molemmat.
- Loki-taulukko sarakkeella `Endpoint`.
- Selkeä huomautus: harvesterin auto-esto reagoi vain results-endpointtiin.

### 5. Aja välittömästi käsin

Ensimmäisen deployn jälkeen käynnistetään monitor-hook kerran käsin, jotta näet heti näkyykö results-endpointille vielä esto vai onko sekin auennut. Jos results toimii, harvesteri poimii datan seuraavassa cron-ajossa itsestään.

## Tekniset kohdat

- Uusi kolumni: `ALTER TABLE public.tuloslista_probe_log ADD COLUMN endpoint text NOT NULL DEFAULT 'list'`. Vanhat rivit merkitään `list`.
- `src/routes/api/public/hooks/monitor-tuloslista.ts`: kaksi peräkkäistä fetchia, molemmat kirjataan omalla `endpoint`-arvolla.
- Auto-eston laskuri: kirjataan `harvest_state.consecutive_result_failures` (uusi kolumni int) ja lauetaan `blocked=true` kun >= 2. Onnistunut results-probe nollaa laskurin ja purkaa eston.
- `src/lib/tuloslista-probe.functions.ts`: palauta viimeisimmät rivit sekä `list`- että `results`-suodatuksella; laajenna manuaalitesti tekemään molemmat kyselyt.
- `src/routes/admin.tuloslista-probe.tsx`: kaksi tilakorttia ja endpoint-sarake taulukkoon.

## Mitä ei muuteta

- Nykyisen harvesterin kyselyreittiä ei muuteta.
- `harvest-results.ts`-eston tarkistuslogiikkaa ei muuteta (lukee edelleen `harvest_state.blocked`).
