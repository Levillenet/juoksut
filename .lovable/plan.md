## Tavoite
Kilpailun aikataulu -ominaisuuden **Seurannassa** ja **Oma seura** -näkymiin:
1. Lisää urheilijan nimen perään PB ja SB, kun ne löytyvät live-tuloslistalta.
2. Poista urheilijan numero (`#1091`) kokonaan näkyvistä — sitä ei näytetä missään.

## Tausta
`Allocation`-tyypissä on jo `PB`, `SB` ja `Number` (`src/lib/tuloslista.ts`). Numero näytetään tällä hetkellä molemmissa näkymissä, PB/SB ei kummassakaan. Erillistä PDF-generaattoria ei ole — sama JSX päätyy myös tulosteeseen.

## Muutokset

| Tiedosto | Kohta | Toimenpide |
|---|---|---|
| `src/routes/print.watched.tsx` | Rivit 259-263 (`{e.alloc.Number && …}`-lohko) | Poista koko lohko |
| `src/routes/print.watched.tsx` | Rivit 246-263 (urheilija-`<li>`) | Lisää nimen/seuran perään `PB <arvo>` ja `SB <arvo>`, kumpikin vain jos kenttä ei ole tyhjä |
| `src/routes/print.club.tsx` | Rivit 302-305 (`{e.alloc.Number && …}`-lohko) | Poista koko lohko |
| `src/routes/print.club.tsx` | Urheilija-`<li>` rivin 300 ympärillä | Sama PB/SB-lisäys identtisellä muotoilulla |

## Muotoilu
- Esim. `Pikkusaari Peetu  EsA  PB 12,34  SB 12,50`
- `text-xs`, `text-muted-foreground`, label (`PB`/`SB`) `font-semibold`.
- Tyhjät arvot piilotetaan; jos kumpaakaan ei ole, mitään ei lisätä.

## Muutosten ulkopuolella
- Ei muutoksia /print -lajilistaan eikä YAG calling -näkymään.
- Ei tietorakenne- tai kyselymuutoksia.
