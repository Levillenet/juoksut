## Muutos

Tiedostossa `src/routes/round.$eventId.$roundId.tsx` (rivi 419) osion otsikko on aina "Lopputulokset", vaikka kilpailu on vielä käynnissä.

Vaihdetaan otsikko dynaamiseksi kierroksen tilan (`round.Status`) mukaan:

- `round.Status === "Official"` → **"Lopputulokset"** (nykyinen teksti)
- muutoin → **"Tilanne tällä hetkellä"**

Kilpailijamäärän suluissa oleva teksti säilyy ennallaan.

## Tekniset yksityiskohdat

Rivin 418–423 `<h2>` muutetaan käyttämään ternaryä `round?.Status === "Official" ? "Lopputulokset" : "Tilanne tällä hetkellä"`. `round`-muuttuja on jo saatavilla samassa komponentissa (käytetty rivillä 182).

Muita tiedostoja ei muuteta.