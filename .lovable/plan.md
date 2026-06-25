## Selite vihreälle varmistus-merkille

Lisätään pieni selite vihreälle pisteelle erän lähtöjärjestys -näkymään (`src/routes/round.$eventId.$roundId.tsx`), jotta käyttäjä ymmärtää mitä merkki tarkoittaa.

### Muutokset

**Tiedosto:** `src/routes/round.$eventId.$roundId.tsx`

1. **Ilmoittautuneet-listan otsikkopalkki (rivi ~144–152)** — kun eräjakoja ei ole vielä tehty mutta ilmoittautuneita on:
   - Korvataan oikean reunan teksti `"Eräjakoja ei ole vielä tehty"` kahden rivin sisällöllä:
     - rivi 1: `Eräjakoja ei ole vielä tehty`
     - rivi 2: `Urheilija varmistanut` + vihreä `ConfirmedDot` perässä
   - Pidetään tyyli `text-xs text-muted-foreground`, pieni `gap`/`mt-0.5` rivien välissä, oikealle tasattu.

2. **Tyhjä tila (rivit 131–140)** — kun ilmoittautuneitakaan ei ole, jätetään ennalleen (selitettä ei tarvita, koska listaa ei näytetä).

3. **Eräjakojen jälkeen** — kun heatit on jaettu, lisätään sama pieni selite (`Urheilija varmistanut` + vihreä piste) hienovaraisesti heat-listan yläpuolelle (juuri ennen ensimmäistä `Erä`-otsikkoa), oikealle tasattuna pienellä `text-xs text-muted-foreground` -tyylillä, jotta sama selitys löytyy myös eräjaon jälkeisestä näkymästä.

Ei muutoksia muihin näkymiin (announcer, scoreboard) tässä vaiheessa — käyttäjä pyysi selitteen nimenomaan aikataulun lajisivulle.
