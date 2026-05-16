## Löydetyt bugit

**1. Kelloseppä — väärä aikalaskenta**

Tietokannassa `result_numeric` on rikki pidemmissä juoksuissa. Esim. 800m tulos `result_text = "2.58,25"` (2 min 58,25 s = 178,25 s), mutta `result_numeric = 2.58`. Nykyinen koodi summaa nämä `result_numeric`-arvot suoraan sekunteina, joten 800-metrin juoksu lasketaan ~2,5 sekunniksi.

**2. Hyppykirppu / Heittotykki — laskee tuloksia, ei yrityksiä**

Tietokannassa on yksi rivi per urheilija per laji (lopputulos), ei yritystä per rivi. Pituushypyssä lapsi hyppää tyypillisesti 3–6 kertaa, mutta nykyinen mittari laskee vain yhden "hypyn".

## Korjaukset

**`src/lib/season-stats.ts`** — uusi apuri `parseTrackSeconds(resultText)`:
- `"2.58,25"` → `2*60 + 58.25 = 178.25`
- `"58,25"` → `58.25`
- `"1.23.45,6"` (tunnit) → `1*3600 + 23*60 + 45.6`
- Palauttaa `null`, jos ei matchaa numeerista muotoa (DNS/DNF/DQ).

**`src/lib/fun-stats.ts`**:
- `Row`-tyyppiin lisätään edelleen `result_text` (jo on).
- Kelloseppä: vaihda `a.runSeconds += r.result_numeric` → käytä `parseTrackSeconds(r.result_text) ?? r.result_numeric`.
- Hyppykirppu/Heittotykki: kerro yritysarviolla. Käytetään vakiota `ATTEMPTS_PER_FIELD = 4` per validi tulos (kun `result_numeric != null && > 0`). DNS/DNF (ei numeerista) lasketaan 0. Päivitetään formaattiteksti pysymään "X hyppyä" / "X heittoa" — luku tarkoittaa nyt arvioituja yrityksiä.
- Päivitä mittarien kuvaukset: "Eniten hyppy-/heittoyrityksiä (≈ 4 / kisalaji)." jotta käyttäjä ymmärtää arvion.

## Mitä ei muuteta

- UI-komponentit (`FunStatCard`, `hauskat-tilastot.tsx`) pysyvät ennallaan.
- Muut mittarit, seura-/ikäluokkavalinnat ja kysely pysyvät ennallaan.
