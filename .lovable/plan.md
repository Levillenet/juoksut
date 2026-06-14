
# VAIHE 2 — Edge Function `compute-duration-stats` (lopullinen)

Lisäykset hyväksytty:
- Mappaus `athlete_results.age_class` → `event_duration_stats.group_name`.
- JSON-palaute sisältää `sample_results` (10 ensimmäistä tilastoa n_samples desc).

## Toteutus

1. **Migraatio**: `ALTER TABLE event_duration_stats ADD COLUMN p10_duration_min REAL` (tehty).
2. **`supabase/functions/compute-duration-stats/index.ts`**:
   - POST, CORS, admin-tarkistus `is_admin_user()` RPC:llä kutsujan JWT:stä.
   - Paginoitu luku `athlete_results`-taulusta (10k riviä kerrallaan) service rolella.
   - Ryhmittely (competition_id, event_id, day=YYYY-MM-DD UTC) → kerää min/max captured_at + distinct athlete_keys.
   - Run-suodatus: `1 ≤ duration_min ≤ 600` JA `participants ≥ 2`.
   - Toinen ryhmittely (event_name, age_class), kerää kestot+osallistujat.
   - Jätä tilasto pois jos `n_samples < 3`.
   - Laske n, median, p10, p90 kestoista; median + max osallistujista; category/sub_category = enemmistö.
   - Upsert `event_duration_stats` (onConflict event_name,group_name), 500/chunk.
   - Poista vanhentuneet rivit (`last_updated < run_start`).
   - Palauta: `ok, rows_processed, runs_considered, runs_accepted, stats_upserted, stats_skipped_low_n, stats_deleted_stale, duration_ms, sample_results[10]`.
3. **Deploy + aja kerran** `supabase--curl_edge_functions`-työkalulla (preview-session, admin-JWT).
4. **Näytä palautteen summary + sample_results**.

Ei admin-UI:tä, ei `planner-estimate.ts`-muutoksia, ei cronia.

**Siirry build-modeen jatkaaksesi.**
