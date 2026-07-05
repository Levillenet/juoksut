## Ongelma

Kuuluttajanäkymässä (Käynnissä / Lopputulokset) juoksujen alkuerät renderöidään `EventCard`-komponentissa yhtenä lopputuloslistana, jossa on kokonaisjärjestys (`ResultRank`). Alkuerissä ei ole olemassa "lopputulosta" eikä yhteisjärjestystä — jokaisella erällä on oma tulostaulukko.

## Ratkaisu

Näytetään alkuerä-tyyppisten kierrosten (Track-lajit, joiden `round.Name` sisältää "alkuer") kortti eräkohtaisina taulukoina samaan tapaan kuin `UpcomingItem` jo tekee (`isTrackHeats`-haara), sekä käynnissä- että lopputulokset-listalla. Ei kokonaisjärjestystä, ei ResultRank-otsikkoa "Lopputulokset".

### Muutokset

1. **`src/lib/tuloslista.ts`** — lisätään pieni apuri `isHeatRound(round: Pick<Round, "Category" | "Name">): boolean`, joka palauttaa `true` kun `Category === "Track"` ja `Name` sisältää `alkuer` (case/aksentti-insensitiivisesti). Käytetään samaa logiikkaa kuin `yag-calling-match.ts:phaseTag`.

2. **`src/components/announcer/shared.tsx`** — `EventCard`:ssä, kun `isHeatRound(round)` on tosi ja `detail` on ladattu:
   - Renderöidään otsikko-osan alle eräkohtainen listaus samalla tyylillä kuin `UpcomingItem`:n `isTrackHeats`-haara: iteroidaan `matchingRound.Heats` `Index`-järjestyksessä, jokaisen erän sisällä sortataan `Position`-kentällä (tai `HeatRank`illa jos tulokset ovat tulleet), ja käytetään `AllocationRow`ta `showRank="position"` kunnes erän `Allocations` sisältää tuloksia, jolloin `"result"`. Näin näytetään ratanumero ja tulos, mutta ei kokonaissijoitusta.
   - Kun `open === false` (kortti kiinni käynnissä-listalla), näytetään "Erä N — X/Y tulosta" -yhteenvetorivit tiiviisti sen sijaan, että näytettäisiin top-3.
   - Kun `open === true`, näytetään kaikki erät kokonaan. Alareunan "Avaa täysi näkymä →" -linkki säilyy.
   - Ei-alkuerä-kierrokset (finaalit, kenttälajit) säilyvät nykyisessä flat-ranking -esityksessä muuttumattomana.

3. **Ei muutoksia** `useAnnouncerData`iin: alkuerä siirtyy edelleen `completedAllMerged`-listalle vasta kun kaikki erät ovat valmiit (aiemmin tehty korjaus). Näytetään siellä samalla eräkohtaisella tyylillä `EventCard`in kautta.

### Muuta huomioitavaa

- Ennätysmerkintöjen (`RecordBadge`) tunnistus säilyy `AllocationRow`ssa.
- FLIP-animaatio ja rank-nuolet koskevat vain flat-listaa; alkuerä-haara ei tarvitse niitä.

### Verifiointi

- Kouvola Games N1500 alkuerä käynnissä: kortti näyttää Erä 1 / Erä 2 -taulukot ratajärjestyksessä, ei kokonaissijoitusta.
- Kun kaikki erät valmiit, sama kortti siirtyy Lopputulokset-osioon ja näyttää edelleen eräkohtaiset taulukot (nyt tulosten kera), ei "1. 2. 3." kokonaislistaa.
- Finaali/kenttälaji: ennallaan.
