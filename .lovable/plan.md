## Tavoite

Kilpailun aikataulu -näkymässä (`/print`) jokaisen lajirivin pitää olla klikattavissa, niin että käyttäjä pääsee suoraan lajin erien ja tilanteen näkymään (`/round/$eventId/$roundId`).

## Korjaus — `src/routes/print.index.tsx`

1. Lisätään `Link`-import on jo olemassa.
2. Taulun rivin (`<tr>` rivit 184–195) sisältö kääritään `Link`-komponenttiin reitille `/round/$eventId/$roundId`, parametreina `eventId: String(r.EventId)` ja `roundId: String(r.Id)`. Linkki näytetään vain ruudulla (`print:hidden` ei sovi koko riville koska teksti pitää näkyä — käytetään sen sijaan tyylimuokkausta niin että print-tilassa linkki näyttää tavalliselta tekstiltä).
   - Käytännössä koko `<tr>`:n sisältö wrapataan `<Link className="block ...">`-komponenttiin solujen sisällä, tai (siistimpi) muutetaan markup niin että aika+laji sisältö on `<td colSpan=2>`:n sisällä yksi `<Link>`, jolloin koko rivi tulee klikattavaksi.
3. Lisätään visuaalinen vihje, että rivi on klikattava (esim. `hover:bg-secondary cursor-pointer`-tyyli ruudulla, ei tulosteessa).
4. Print-tila pidetään ennallaan: `print:hover:bg-transparent` ja `print:no-underline`, jotta tulostus näyttää samalta.

## Tekninen huomio

- `Round`-tyypissä on jo `Id` ja `EventId`, joten muita kyselyitä ei tarvita.
- `/round/$eventId/$roundId` on julkinen reitti, sopii kaikille käyttäjille.
- Ei muutoksia muihin tiedostoihin eikä tietokantaan.