## Suunnitelma: Poista urheilijanumero calling-aikataulusta

### Tavoite
Urheilijanumeroa (esim. `#1091`) ei näytetä enää calling-aikataulussa eikä sen PDF:ssä.

### Muutokset

| Tiedosto | Rivi / Kohta | Toimenpide |
|---|---|---|
| `src/routes/print.yag-calling.tsx` | Rivi 402-406 — `e.alloc.Number`-lohko urheilijaluettelossa | Poista koko `#{e.alloc.Number}`-renderöintilohko |
| `src/lib/yag-calling-pdf.ts` | Rivi 100 — `parts.push(`#${e.alloc.Number}`);` | Poista numeron lisäys PDF-soluun |

### Tulos
Calling-aikataulussa näkyy jatkossa vain `Sukunimi Etunimi Seura`, ilman `#123`-numerotunnistetta.