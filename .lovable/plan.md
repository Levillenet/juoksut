## Tavoite

Etusivun "Seuran urheilijat tänään" -listalla sijoituksen pitää näyttää, missä kierroksessa se on saavutettu. Nyt lukee "sija 5 · PB 10,77 · Alkuerät" — pitää lukea "Alkuerät sija 5 · PB 10,77", jotta on selvää että sija 5 on alkueristä eikä loppukilpailusta.

## Muutos

Tiedosto: `src/components/ClubTodaySection.tsx` (rivit 256–258)

Korvataan rivit niin että `result_round_name` näkyy `sija`-merkinnän edessä:

```
{r.result_round_name && r.result_rank != null
  ? ` · ${r.result_round_name} sija ${r.result_rank}`
  : r.result_rank != null
    ? ` · sija ${r.result_rank}`
    : null}
{pb && ` · PB ${pb.text}`}
```

Eli:
- Jos kierroksen nimi on tallessa (esim. "Alkuerät") JA sija on tiedossa → "· Alkuerät sija 5"
- Jos vain sija tiedossa (loppukilpailu, normaalitilanne) → "· sija 5" (entinen näkymä)
- Loppukilpailussa `result_round_name` on tyhjä, joten esitys ei muutu muille riveille

## Mitä ei muuteta

- Tietokantaa eikä harvesteria — data on jo oikein (Tobiaksen rivillä `result_round_name = "Alkuerät"`, `result_rank = 5`)
- Tulosteita (print.*) eikä muita näkymiä
- PB-logiikkaa
