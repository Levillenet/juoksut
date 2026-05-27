## Ongelma

`CompetitionSwitcher` käyttää Radix Selectiä, joka avautuu valitun arvon kohdalta. Jos käyttäjällä on aktiivisena menneen päivän kisa, valikko avautuu historiaan eikä tämän päivän kohdalle.

## Muutos

`src/components/CompetitionSwitcher.tsx`:

1. Lisää `id`-attribuutti tämän päivän `SelectLabel`-elementtiin (esim. `data-today="true"`).
2. Lisää `onOpenChange`-handleri `<Select>`-komponentille: kun `open === true`, scrollaa pienellä viiveellä (rAF/setTimeout 0) `[data-today="true"]`-elementti `SelectContentin` sisällä näkyviin `scrollIntoView({ block: "start" })`.
3. Jos tämän päivän ryhmää ei löydy (ei kisoja tänään), ei tehdä mitään → Radixin oletuskäytös (valittu arvo) jää voimaan.

Ei muita muutoksia. Toiminta säilyy: valittu kisa pysyy korostettuna, mutta näkymä keskittyy aina tähän päivään kun valikko avataan.