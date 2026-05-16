## Tavoite

Suorituspaikkojen livenäkymässä (announcer/live ja announcer/combined → `EventCard` `src/components/announcer/shared.tsx`) lista järjestyy nyt uudestaan välittömästi kun uusi tulos saapuu — rivit "hyppäävät" uuteen kohtaan. Lisätään tyylikäs liuku-animaatio, jossa kilpailija nousee esim. 4. → 1. visuaalisesti liukuen muiden valuessa alaspäin. Nykyiset ylös/alas-nuolet säilyvät pikkuvihjeinä.

## Lähestymistapa

Käytetään FLIP-tekniikkaa (First-Last-Invert-Play) ilman uutta riippuvuutta — pelkkää Reactia + Web Animations APIa (`element.animate`). Tämä toimii hyvin lyhyissä listoissa (top 3–N), ei vaadi `framer-motion`-paketin lisäystä, ja sopii projektin nykyiseen kevyeen tyyliin.

### Toteutus pähkinänkuoressa

`EventCard`-komponentissa (sama paikka jossa `rankChanges` jo lasketaan):

1. Annetaan jokaiselle `<li>`-riville `ref` Map-rakenteen kautta (`refs.current.set(allocId, el)`).
2. Talletetaan jokaisen rivin edellinen `getBoundingClientRect().top` `useLayoutEffect`issa **ennen** kuin uusi järjestys renderöityy (rerenderin alku).
3. Uuden renderin jälkeen toisessa `useLayoutEffect`issa:
   - lasketaan jokaisen rivin uusi `top`
   - jos rivi liikkui, kutsutaan `el.animate([{ transform: 'translateY(<delta>px)' }, { transform: 'translateY(0)' }], { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })`
   - "voittajariville" (jonka uusi sija = 1 ja vanha > 1) annetaan vahvempi korostus: lyhyt scale-pulssi `[{ transform: 'translateY(...) scale(1.02)' }, { transform: 'translateY(0) scale(1)' }]` + `box-shadow` ring `ring-2 ring-primary/60`-luokka noin 1.5 s ajan.
4. Käytetään `key={a.AllocId}` (jo käytössä) jotta React säilyttää DOM-noden ja animaatio kohdistuu samaan elementtiin.
5. Lisätään `ol`-säiliölle ja `li`-elementeille `will-change: transform` vain animaation ajaksi.

### Rajaukset

- Animaatio koskee **vain** `EventCard`-listaa (livenäkymän kenttälajikortit). Lopputulokset, print-näkymät, scoreboard ja `UpcomingItem` jätetään ennalleen — siellä ei ole jatkuvaa rerankausta.
- Animaatio laukeaa vain kun rivin sija oikeasti muuttui (delta ≠ 0). Ensirenderissä ei animoida.
- Kunnioitetaan `prefers-reduced-motion`-asetusta: jos asetettu, ohitetaan animaatio ja näytetään rivit normaalisti (nuolet riittävät).
- Pidetään animaation kesto n. 500–700 ms — riittävän huomattava esiintyjälle/kuuluttajalle mutta ei häiritsevä.

## Muutettavat tiedostot

- `src/components/announcer/shared.tsx` — `EventCard`: lisätään refit, kaksi `useLayoutEffect`iä FLIPiä varten, voittajakorostus. Ei API- eikä tyylimuutoksia muualle.

## Mitä ei muuteta

- Mitään dataa, lajien lajittelua, sijoituslogiikkaa tai `rankChanges`-laskentaa.
- Ei lisätä uusia npm-paketteja.
- Muut näkymät (lopputulokset, print, watch, seuraa, scoreboard).