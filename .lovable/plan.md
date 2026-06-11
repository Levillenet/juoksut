## Tavoite
Mobiilissa (esim. 374px) `/print`-näkymien yläpalkin välilehdet ("Kilpailun aikataulu", "Seuran urheilijat", "Omat urheilijat", "YAG Calling") näkyvät kerralla ilman vaakasuuntaista skrollausta. Pöytäkoneella ulkoasu säilyy ennallaan.

## Muutos: `src/components/PrintTabs.tsx`

1. Lisää jokaiselle välilehdelle lyhyt mobiililabel ja näytä se alle `sm`-breakpointin, pitkä label `sm:` alkaen.
   - "Kilpailun aikataulu" → mobiilissa "Aikataulu"
   - "Seuran urheilijat" → "Seura"
   - "Omat urheilijat" → "Omat"
   - "YAG Calling" → "YAG"
2. Vaihda rivin layout mobiilissa tasajakoiseksi gridiksi (yksi sarake per näkyvä välilehti) niin että koko leveys käytetään eikä mitään leikkaudu. `sm:` alkaen palautetaan nykyinen `flex gap-2 overflow-x-auto` (säilyttää nykyisen tyylin isommilla näytöillä).
   - Mobiili: `grid` jossa `grid-template-columns: repeat(<näkyvien määrä>, minmax(0,1fr))`, pieni `gap-1.5`, ei `overflow`.
3. Pienennä mobiilipillerien paddingia ja fonttia jotta ne mahtuvat: `px-2 py-1.5 text-[12px]`, `sm:px-4 sm:py-2 sm:text-sm`. Poista `shrink-0` mobiilissa (ei tarvita gridissä) ja `truncate` napin sisälle varmuudeksi.
4. Aktiivisuuslogiikka ja roolifiltteröinti säilyvät täysin ennallaan.

## Tekninen yhteenveto
- Vain `PrintTabs.tsx` muuttuu — ei muutoksia reitteihin, dataan, eikä muihin print-sivuihin.
- Mobiilissa käytetään dynaamista grid-tyyliä (`style={{ gridTemplateColumns: \`repeat(${visible.length}, minmax(0,1fr))\` }}`) jotta ratkaisu toimii sekä 3 että 4 näkyvälle välilehdelle (rooli/kisa vaikuttaa).
- Ei uusia riippuvuuksia.
