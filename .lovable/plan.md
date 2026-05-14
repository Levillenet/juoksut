# Korjaus: kenttälajit katoavat Käynnissä-paneelista

## Syy

`src/routes/announcer.tsx` (rivit 191–202) lisää kierroksen `finishedProgressRoundIds`-settiin heti kun event-detail-endpointin `round.Status === "Official"`, ja `inProgressVisible` suodattaa sen pois Käynnissä-listasta. Tuloslistan API raportoi kenttälajeissa (etenkin korkeus/seiväs) detail-endpointin `Round.Status` arvon `Official` jo silloin kun kilpailu on käytännössä loppumassa mutta vielä käynnissä — tai eri tahdissa kuin kisalistaus. Lopputulos: kenttälaji katoaa ennen aikojaan, eikä päädy Lopputuloksiin, koska samanaikaisesti `completedAll` ei vielä sisällä sitä ja merge-haara käyttää samaa flagia.

Alkuperäinen ongelma, jota tämä logiikka ratkaisi, koski juoksulajeja (Track), joissa kisalistauksen status päivittyy hitaasti. Sama promotointi ei ole tarpeen kenttälajeille — kenttälajit pysyvät kisalistan mukaan `Progress`-tilassa luotettavasti, ja kuuluttaja haluaa nähdä ne käynnissä-paneelissa kunnes ne oikeasti virallistuvat.

## Muutos

`src/routes/announcer.tsx`, `finishedProgressRoundIds`-useMemo:

Lisää ehto, että kierros promotoidaan vain jos sen `Category === "Track"`. Kenttälajeja ei koskaan oteta tästä lyhytsulusta vaan ne seuraavat kisalistauksen statusta.

```ts
for (const r of inProgressAll) {
  if (r.Category !== "Track") continue; // älä promotoi kenttälajeja
  const ev = details[r.EventId];
  ...
}
```

Ei muita muutoksia. Kenttälajien näyttölogiikka, attempts-merkki ja juoksulajien promotointi pysyvät ennallaan.

## Lopputulos

Kenttälajit näkyvät Käynnissä-paneelissa niin kauan kuin kisalistaus raportoi ne `Progress`-tilassa, ja siirtyvät Lopputuloksiin vasta kun listaus saa `Official`-statuksen. Juoksulajit saavat edelleen nopean promotoinnin detail-endpointin kautta.
