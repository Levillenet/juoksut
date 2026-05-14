## Ongelma

tuloslista.com voi päivittää urheilijan `PB`/`SB`-kentän heti kun uusi tulos kirjataan. Kun kysymme API:lta vasta sen jälkeen, vertailemme uutta tulosta jo päivitettyyn ennätykseen → `detectRecord` palauttaa `null` ja tähti jää näkymättä. Nykyinen toteutus toimii vain jos olemme ehtineet hakea lähtörivin tiedot ennen tuloksen kirjausta.

## Ratkaisu: jaettu PB/SB-snapshot tietokantaan

Otetaan **kerran-talteen-jää-talteen** -lähestymistapa. Heti kun kuka tahansa käyttäjä avaa kisan/lajin ja näkee allokaation, jossa on PB tai SB mutta **ei vielä `Result`-arvoa**, tallennamme PB:n ja SB:n snapshotiksi tietokantaan. Vertailu tehdään aina snapshotia vastaan, ei API:n nykyarvoa.

Snapshot on **kisakohtainen ja jaettu kaikille käyttäjille** — ei per käyttäjä. Näin yhdenkin käyttäjän (esim. kuuluttaja-näytön) varhainen lataus riittää tallentamaan baseline kaikille muillekin.

### 1. Tietokantataulu

```sql
create table public.record_baseline (
  competition_id int  not null,
  event_id       int  not null,
  athlete_id     int  not null,   -- Allocation.Id (urheilijan id)
  pb             text not null default '',
  sb             text not null default '',
  captured_at    timestamptz not null default now(),
  primary key (competition_id, event_id, athlete_id)
);

alter table public.record_baseline enable row level security;

-- Kaikki kirjautuneet käyttäjät näkevät
create policy "anyone authenticated can read"
  on public.record_baseline for select
  to authenticated using (true);

-- Kaikki kirjautuneet voivat lisätä uusia rivejä; vanhoja ei muuteta
create policy "anyone authenticated can insert"
  on public.record_baseline for insert
  to authenticated with check (true);
```

Ei UPDATE- eikä DELETE-policya → ensimmäinen tallennus jää voimaan. Jos joku yrittää lisätä jo olemassa olevan `(competition_id, event_id, athlete_id)`-yhdistelmän, primary key estää sen ja `ignoreDuplicates: true` `upsert`issa nielee virheen hiljaisesti.

### 2. Snapshot-keruu (`src/lib/record-baseline.ts`)

Uusi moduuli:

```ts
captureBaselines(competitionId, eventId, allocations)
  // Suodattaa allokaatiot: vain ne, joilla on PB tai SB JA ei vielä Result
  // Upsert insert-only -semantiikalla
  // De-duplikoi paikallisesti (Set) ettei tehdä turhia kutsuja samalle id:lle
  
loadBaselines(competitionId, eventId): Promise<Map<athleteId, {pb,sb}>>
  // Hakee kerralla kaikki kisan/lajin baseline-rivit
```

Cache-kerros: pidetään moduulin sisäinen `Map<eventId, Map<athleteId, baseline>>`, ettei jokainen render hae tietokannasta. Auto-refresh (kuuluttaja 15 s, watch 60 s) kutsuu `loadBaselines` uudelleen vain harvoin (esim. kun event_id ei vielä ole cachessa, tai max kerran per minuutti per laji).

### 3. Käyttöönotto kolmessa näkymässä

**`src/routes/announcer.tsx`**
- `loadDetailsFor`-effektin sisällä, kun `fetchEvent` palauttaa `EventResults`:
  1. `await captureBaselines(competitionId, ev.Id, kaikki allokaatiot)`
  2. `await loadBaselines(competitionId, ev.Id)` → lisätään cacheen
- `RecordBadge`/`detectRecord`-kutsut käyttävät `baselines.get(a.Id)?.pb ?? a.PB` ja vastaava SB:lle, fallback API:n arvoon jos baselinea ei ole.

**`src/routes/round.$eventId.$roundId.tsx`**
- `load()`:n perään sama: `captureBaselines` + `loadBaselines`.
- `RecordBadge`-propsiin baseline-arvot.

**`src/routes/watch.tsx`**
- `buildIndex`-workerin sisällä, kun `fetchEvent` palauttaa: sama capture + load. Talletetaan baseline samaan `IndexedEntry`-rakenteeseen tai erilliseen `Map<athleteId, baseline>`:hen, joka annetaan render-vaiheessa `RecordBadge`:lle.

### 4. Snapshot-poliittinen logiikka

Otamme baselineen sen mitä API antaa **sillä hetkellä, kun urheilijalla ei vielä ole `Result`-arvoa kyseisessä lajissa**. Tämä tarkoittaa:

- Jos baseline-rivi on jo olemassa → emme koskaan ylikirjoita sitä.
- Jos urheilijalle ei ole vielä baselinea ja `Result` on jo kirjattu → emme tallenna mitään (liian myöhäistä → tähti jää näyttämättä, koska emme voi vahvistaa parantuiko vai ei).
- Jos urheilijalla ei ole PB:tä eikä SB:tä → ei tallennusta (eikä myöhemmin tähteä, mikä on jo nykykäytäntö).

`detectRecord` ja `RecordBadge` muutetaan ottamaan baseline-arvot suoraan parametreiksi (eivät enää lue API:n PB/SB:tä). Komponenttipuolella johdetaan: `pb = baseline?.pb || alloc.PB` (käytetään API:n arvoa vain jos baselinea ei ole).

### 5. Edge case: paljonko parannus oli?

`formatImprovement(category, result, baselinePB)` toimii suoraan — käyttää baselinea referenssinä, joten parannus näytetään oikein vaikka API olisi jo päivittänyt PB:n.

## Mitä EI tehdä

- Ei oteta käyttöön RLS-policya UPDATE- tai DELETE-operaatioille → admin pääsee näihin vain SQL-konsolin kautta jos joskus halutaan korjata virhetallennus.
- Ei pre-fetch-loopata kaikkia kisan lajeja proaktiivisesti — luotetaan että vähintään yksi käyttäjä (kuuluttaja tai watch-sivun käyttäjä) avaa lajit ennen niiden alkua. Tämä on käytännössä aina tilanne, koska watch-sivu indeksoi kaiken kisan auettua.
- Ei tehdä per-erä-snapshotia (vain per laji/urheilija). Jos urheilija parantaa PB:n erässä 1 ja juoksee uudestaan erässä 3, sekä erän 1 että erän 3 tähti vertaa kisan alun arvoon — molemmat ovat "uusi PB" suhteessa lähtöriviin, mikä on toivottu käytös.

## Tekninen huomio

- Athlete id on `Allocation.Id` (urheilijan globaali id, ei alloc-rivin id). `AllocId` vaihtuu erien välillä, joten sitä ei käytetä.
- Tarvitsemme migraation luomaan taulun + RLS:t.
- `record_baseline`-tauluun ei lisätä foreign keytä, koska competition/event-id:t tulevat ulkoisesta API:sta.
- `captureBaselines` on tahallisesti idempotentti ja "fire-and-forget" tyylinen — virheitä ei näytetä käyttäjälle, koska puuttuva snapshot ei estä mitään muuta toiminnallisuutta.
- Anonyymit (kirjautumattomat) käyttäjät eivät pysty tallentamaan baselineja (RLS vaatii `authenticated`). Käytännössä kaikki käyttäjät kirjautuvat (joko käyttäjä, Google tai toimitsija), joten tämä riittää.
