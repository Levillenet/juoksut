## Miksi lataus kestää ~30 s

YAG Calling -näkymä kutsuu `competitionIndexQueryOptions(YAG_COMPETITION_ID)` -kyselyä, joka rakentaa koko kisan (yli sata lajia) tasaisen listan (kierros + allocation) selaimessa. Per laji se tekee:

1. `GET /api/public/tuloslista/live/v1/results/{id}/{eventId}` — proxy-välimuistilla nopea (~5–20 ms lämpimänä), mutta kylmänä 200–800 ms originista.
2. `captureBaselines(...)` → Lovable Cloud `upsert` `record_baseline`-tauluun.
3. `loadBaselines(...)` → Lovable Cloud `select` `record_baseline`-taulusta.

Rinnakkaisuus on `CONCURRENCY = 6`. Jos kisassa on ~150 lajia, se on ~25 aaltoa, ja jokaisessa aallossa hitain on noin 2 DB-roundtripiä (~80–150 ms/kpl) + 1 API-kutsu. → tyypillisesti 25 × ~300 ms = ~8–15 s lämpimänä, kylmänä yli 30 s.

YAG Calling -näkymä **ei käytä PB/SB-baselineja lainkaan** — se vain matchaa urheilijat (`Surname`, `Firstname`, `OrganizationId`) kalenterin riveihin. Baseline-kutsut ovat siis täysin turhia tässä käyttötapauksessa, mutta muut näkymät (`watch`, `print.club`, `print.watched`, `seuraa.$token`) tarvitsevat ne.

## Korjaus

Yksi kohdistettu muutos: lisätään `competitionIndexQueryOptions`:lle valinnainen `skipBaselines`-lippu, ja `print.yag-calling` antaa sen `true`. Muiden näkymien käyttäytyminen ei muutu.

Samalla nostetaan `CONCURRENCY` 6 → 12. Proxy/cache kestää tämän hyvin (single-flight koalisoi rinnakkaiset pyynnöt) ja se puolittaa aaltojen määrän.

### Muutoskohdat

1. **`src/lib/tuloslista-queries.ts`**
   - Lisää `options?: { skipBaselines?: boolean }` parametri `competitionIndexQueryOptions`:lle.
   - Kun `skipBaselines === true`, ohitetaan sekä `captureBaselines` että `loadBaselines` per laji.
   - Eriytetään `queryKey` lipun mukaan, jotta sama välimuisti ei sekoa muille kutsujille:
     `["competition-index", id, skipBaselines ? "no-baselines" : "baselines"]`.
   - Nosta `CONCURRENCY = 12`.

2. **`src/routes/print.yag-calling.tsx`**
   - Käytä `competitionIndexQueryOptions(YAG_COMPETITION_ID, { skipBaselines: true })`.
   - `onProgress`-callbackin paikka muuttuu nimettyihin optioihin — tarkistetaan ettei kutsuja käytä progressia (ei käytä).

### Odotettu vaikutus

- DB-kutsut per latauskerta: **N × 2 → 0**.
- Aaltojen määrä rinnakkaisuudessa: **puolittuu**.
- Kylmälataus ~30 s → odotettavissa **~8–12 s**, lämmin (proxy-cache osumat) **~2–4 s**.

### Mitä tämä ei korjaa

Jos halutaan vielä nopeampaa (alle 2 s), pitäisi siirtyä server-side aggregaattiin: oma `/api/public/tuloslista/calling-index/{id}` -reitti, joka palauttaa valmiiksi tiivistetyn (laji → allocations) digestin yhdellä pyynnöllä ja cachetetaan reunalla. Tämä on isompi muutos eikä mukana tässä korjauksessa — voidaan tehdä erillisenä tehtävänä jos yllä oleva ei riitä.
