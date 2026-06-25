## Ongelma

Kun lajilla ei ole vielä eräjakoja, lajinäkymä (`/round/:eventId/:roundId`) näyttää vain "Eräjakoja ei ole vielä tehty." vaikka tuloslistan API palauttaa jo `Enrollments`-listan ilmoittautuneista.

## Korjaus

Muokataan `src/routes/round.$eventId.$roundId.tsx`:

1. Kun `heats.length === 0`, tarkistetaan `data.Enrollments`.
2. Jos ilmoittautuneita on, näytetään ne yhtenä listana otsikolla "Ilmoittautuneet (N)" samalla kortti­tyylillä kuin erälistaus, mutta ilman ratanumero­ympyrää (käytetään numerona pelkkää järjestys­numeroa tai jätetään pois).
3. Rivillä: nimi (linkki athlete-sivulle, kuten erälistalla), seura, mahdollinen kilpailunumero, SB/PB.
4. Säilytetään nykyinen "Eräjakoja ei ole vielä tehty" -teksti vain jos myös enrollments-lista on tyhjä.
5. Kun eräjaot tulevat (Heats-lista ei-tyhjä), enrollments-näkymä piilotetaan automaattisesti ja palautetaan nykyinen erälistaus — ei muita muutoksia.

Ei muutoksia API-kerrokseen, dataa, soveltimiin tai muihin reitteihin — `Enrollments` tulee jo `fetchEvent`-vastauksessa.

## Tekninen huomio

- Järjestys: aakkostetaan sukunimen mukaan (luonteva ilmoittautumis­listan default), `NotInCompetition`-merkintä näkyy samalla badgella kuin erä­näkymässä.
- Tiedosto: vain `src/routes/round.$eventId.$roundId.tsx`.
