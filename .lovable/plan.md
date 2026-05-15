## Vahvistus

Tuloslistan API Kouvola Junior Games 19.7.2025, T11 60m, Savolainen Elli:

| Kierros | Aika | Sija |
|---|---|---|
| Alkuerä | 9,35 | 4 |
| **Loppukilpailu** | **9,12** | **4** |

Tietokannassa nyt: `9,35`, sija 4 (alkuerän tulos).

## Yön ajo

Cron ajaa harvesterin joka **2 minuutti** (100 kisa-ID:tä per ajo, 5 rinnakkain). Koko historian (~16456 → 19345 ≈ 2900 ID:tä) uudelleenharvestointi vie noin **60 minuuttia** — yön aikana ehtii moneen kertaan.

Korjattu koodi (edellisestä viestistä) on jo paikallaan:
- Event-tason deduplikointi (paras tulos / urheilija)
- `ignoreDuplicates: false` → olemassa olevat rivit päivittyvät

### Toimenpide

Nollataan harvesterin kursori alkuun, jolloin cron käy koko historian läpi yön aikana ja päivittää kaikki finaalit oikein:

```sql
UPDATE harvest_state
SET next_id = 16456, updated_at = now()
WHERE id = 'singleton';
```

`latest_id` säilytetään (19345), jotta cron pysyy backfill-moodissa kunnes saavuttaa nykyhetken — sitten siirtyy tail-moodiin normaalisti.

### Aamulla tarkistettavaa

1. **Savolainen Elli, kisa 17741** → pitäisi olla `9,12`, sija 4.
2. **Aavikko Siiri, kisa 18978** → pitäisi olla `9,20` (oli `9,33`).
3. **Helmi Kork, kisa 18978** → pitäisi olla `8,70` (oli `8,78`).
4. `harvest_state.next_id` ≈ 19345 (kursori on saavuttanut nykyhetken).

## Tiedostot / komennot

- Ei koodimuutoksia.
- Yksi SQL-update `harvest_state`-tauluun (data-muutos).
