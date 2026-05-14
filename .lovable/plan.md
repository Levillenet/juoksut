## Tavoite

Juoksulajien (Track) Käynnissä-paneelin korteissa näkyy nyt vain sijoitus/lähtörata yhdessä ympyrässä ja kilpailijan numero ei lainkaan. Tehdään radasta ja rintanumerosta selkeästi luettavia.

## Muutos

`src/routes/announcer.tsx` – `EventCard`-listakohta (rivit ~717–751), kun `round.Category === "Track"`:

- Vasemmassa pyöreässä merkissä näytetään aina **rata** (`a.Position`) selkeästi labelin "Rata" kanssa, riippumatta siitä onko tulos jo virallinen. Sijoitus (rank) siirretään tulospalkin viereen pieneksi `1.` / `2.` -merkinnäksi.
- Nimen viereen lisätään **rintanumero**-lätkä (`#a.Number`) tabular-nums fontilla, hieman korostettuna (esim. `bg-primary/10 text-primary`), jotta kuuluttaja löytää sen nopeasti.
- Kenttälajeissa (`Field`) ulkoasu pysyy ennallaan – sija edelleen ympyrässä, ei rata-/numerolätkää.

Lopputulos juoksuissa: jokaisessa rivissä rata ympyrässä vasemmalla, rintanumero nimen vieressä, ja tulos + sija oikealla.

## Tekniset huomiot

- `Allocation.Number` voi olla `null` (esim. viestit) → renderöi numerolätkä vain jos arvo on olemassa.
- `Position` on aina olemassa Track-erissä, joten ratalukua voi näyttää suoraan.
- Ei muutoksia dataan, queryihin tai kenttälajien logiikkaan.
