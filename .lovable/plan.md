## Tavoite
Nopeuttaa `athlete_results`-backfill ~10 h → ~1 h. Riskit hallitaan advisory lockilla ja varovaisella rinnakkaisuudella.

## Muutokset

### 1. Harvester (`src/routes/api/public/hooks/harvest-results.ts`)
- Nosta batch 40 → **100** kisa-ID:tä per ajo.
- Käsittele kisat **5 rinnakkain** (`p-limit`-tyylinen oma chunkkaaja, ei uutta riippuvuutta).
- Säilytä nykyinen logiikka: hae kisa, parsraa tulokset, upsert `athlete_results`, päivitä `harvest_state.next_id`.
- Lisää pieni jitter (50–150 ms) kisojen välillä rate-limit-paineen tasaamiseksi.
- Käsittele 429/503 → keskeytä ajo siististi, ei advansoi kursoria niiden ID:iden yli.

### 2. Päällekkäisyyden esto (advisory lock)
Harvester-handlerin alussa:
```sql
SELECT pg_try_advisory_lock(hashtext('harvest-tuloslista'))
```
Jos lukko ei aukea → palauta 200 `{skipped: true}` heti. Vapauta `pg_advisory_unlock` finally-blokissa.

### 3. Cron-tiheys
Päivitä olemassaoleva `cron.schedule` 10 min → **2 min** välein (insert-työkalulla, ei migraatiolla — sisältää anon keyn).

```text
100 ID × (60/2) = 3000 ID/h  →  ~2500 jäljellä = valmis ~50 min
```

### 4. Rinnakkaisuus toteutuksessa
```ts
async function runChunked<T>(items: number[], size: number, fn: (id: number) => Promise<T>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.allSettled(items.slice(i, i + size).map(fn));
  }
}
```
Pidä Cloudflare Worker -subrequest-budjetti hallinnassa: 100 kisaa × ~1 fetch ≈ 100 → mahtuu.

## Riskit ja niiden hallinta

| Riski | Hallinta |
|---|---|
| Tuloslista.com rate limit / IP-blokki | Vain 5 rinnakkain + jitter; 429/503 → backoff (kursori ei advansoi) |
| Päällekkäiset cron-ajot (2 min < 30 s ajo voi kasaantua) | `pg_try_advisory_lock` |
| Cloudflare Worker CPU-timeout | Batch 100 mahtuu hyvin <30 s kun rinnakkaista |
| Supabase write-piikki | 5 rinnakkain riittävän maltillinen Lovable Cloud -instanssille |
| Yksittäinen parsintavirhe kaataa ajon | `Promise.allSettled` per chunk; virheellinen ID logataan ja ohitetaan |

## Backfillin valmistuttua
Kun `next_id >= latest_id`, kanta on jo "tail mode" -tilassa (re-skannaa viimeiset 30). Voit halutessasi sen jälkeen palauttaa cronin 10 min välein (säästää resursseja). Lisätään tästä kommentti koodiin, ei automaatiota nyt.

## Tiedostomuutokset
- `src/routes/api/public/hooks/harvest-results.ts` — batch 100, rinnakkaisuus 5, advisory lock, 429-backoff, jitter
- Insert (ei migraatio): `cron.unschedule('harvest-tuloslista')` + uusi `cron.schedule` 2 min välein

Ei muutoksia frontend-koodiin.
