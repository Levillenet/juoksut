## Tavoite

Kun `/round/$eventId/$roundId` -näkymässä (tapahtumapaikan live) ilmestyy uusi tulos kilpailijalle, sen rivi korostuu hetkeksi näytön keskellä isona "kortti tulee kameraa kohti" -animaationa ja liukuu sitten omalle paikalleen erä- ja lopputuloslistassa.

## Toteutus

1. **Tunnista uudet tulokset**: lisätään `useRef<Map<allocId, prevResult>>` joka tallentaa edellisen pollauksen tuloksen jokaiselle kilpailijalle. Kun `detailQuery.data` päivittyy ja jonkun `Result` muuttui tyhjästä arvolliseksi (tai parani aiemmasta), merkitään `allocId` "juuri syntyneeksi tulokseksi" lyhyeksi aikaa (esim. 2.5 s). Ensimmäisellä latauksella ei animoida mitään — vain baseline-tallennus.

2. **Overlay-animaatio**: kun uusi tulos havaitaan, renderöidään fixed-position overlay (`position: fixed; inset: 0; pointer-events: none; z-index: 60`) jossa on iso versio tuloskortista (nimi, seura, tulos, sija, mahdollinen RecordBadge). Animaatio kahdessa vaiheessa:
   - **Vaihe 1 (0–600 ms)**: kortti ilmestyy keskeltä `scale(0.3) → scale(1.15)`, opacity `0 → 1`, pieni `translateZ`-tyyppinen vaikutelma blur+shadow:lla. Tausta saa tumman puolittain läpinäkyvän tason.
   - **Vaihe 2 (600–1800 ms)**: kortti pysyy paikoillaan ~1.2 s jotta yleisö ehtii lukea.
   - **Vaihe 3 (1800–2500 ms)**: kortti animoituu FLIP-tyylillä omalle paikalleen listassa: mitataan kohdesijainnin `getBoundingClientRect()` ja interpoloidaan position/scale/opacity sinne, samalla overlay häipyy.

3. **Listan järjestysmuutos**: kun uusi tulos lisätään, `overall`-järjestys saattaa muuttua. Sallitaan tämä luonnollinen DOM-uudelleenjärjestys, ja käytetään pientä CSS-transitionia listan riveille (`transition: transform 400 ms`) FLIP-tekniikalla niin että muut rivit liukuvat ylös/alas pehmeästi. Käytetään React-tasolla yksinkertaisuuden vuoksi `framer-motion`in `LayoutGroup` + `motion.li layout` molemmissa listoissa (erälistat + lopputuloslista).

4. **Useat samanaikaiset tulokset**: jos pollaus tuo monta uutta tulosta yhdellä kertaa, jonotetaan animaatiot peräkkäin (FIFO-queue), jokainen yllä kuvattu 2.5 s sekvenssi. Listan FLIP-liike voi tapahtua rinnakkain.

5. **Sijoittelu**: overlay-kortti keskitetään viewporttiin (`top: 50%; left: 50%; transform: translate(-50%, -50%) scale(...)`). Kohdesijainti haetaan datan attribuutista `data-alloc-id={a.AllocId}` joka lisätään listariveihin (sekä erä- että lopputuloslistassa). Mietitään tilanne jossa kilpailija näkyy molemmissa listoissa: kohteena käytetään lopputuloslistan riviä jos olemassa, muuten erärivi.

6. **Pois käytöstä**: lisätään pieni asetus / oletus että animaatio toimii vain kun `round.Status === "Progress"` ja sivu on näkyvissä (`document.visibilityState === "visible"`). Reduced motion: jos `prefers-reduced-motion`, overlay vain fade-in/out ilman zoomia ja listan FLIP pois.

## Tekniset tiedostot

- `src/routes/round.$eventId.$roundId.tsx` — uusi efekti `prevResultsRef`-vertailulle + animaatiojono + overlay-renderöinti + `data-alloc-id` -attribuutit. Korvataan listojen `<li>` `motion.li`:llä `layout`-propilla.
- Uusi `src/components/announcer/NewResultOverlay.tsx` — overlay-komponentti (tausta + kortti, hoitaa keyframe-animaation `framer-motion`illa).
- `framer-motion` lisätään riippuvuuksiin jos ei ole jo (tarkistettava `package.json`; vaihtoehtoisesti voidaan toteuttaa pelkillä Tailwind/CSS-keyframeilla, mutta FLIP-listalle motion on selkeästi yksinkertaisin).

## Mitä EI muuteta

- Tulosten haku / polling-logiikka (`useQuery`-asetukset) säilyy ennallaan.
- Muiden näkymien (combined, planning) animaatiot, ticker-logiikka, asetukset.
- Olemassa olevat värit / fontit / asettelu — vain animaatio lisätään päälle.
