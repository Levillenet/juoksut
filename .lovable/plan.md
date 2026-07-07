## Ongelma

`/videot`-sivun dialogissa (kun video avataan) iframe käyttää `aspect-video`-luokkaa ilman korkeusrajaa. Leveällä näytöllä (esim. tabletti/foldable) iframe venyy niin korkeaksi, että se täyttää koko `max-h-[90vh]` dialogin. Erän tulokset renderöityvät DOM:issa videon jälkeen, mutta koska dialogilla on `overflow-y-auto` ja iframe vie kaiken näkyvän tilan, tulokset näyttävät menevän "videon päälle" scrollatessa. Kapealla mobiilissa sama vaikutus näkyy myös kun close-nappi jää ylös ja iframe työntyy tulosten alle visuaalisesti (screenshot 1).

## Ratkaisu

Muokataan vain `src/routes/videot.tsx` dialogin sisältöä:

1. **Rajaa iframen korkeus** – korvaa `aspect-video` -laatikko rakenteella joka pitää 16:9-suhteen mutta rajaa maksimikorkeuden esim. `max-h-[45vh]` (mobiili) / `sm:max-h-[50vh]`, esim.:
   ```tsx
   <div className="relative w-full overflow-hidden rounded-md bg-black">
     <div className="aspect-video max-h-[45vh] w-full mx-auto" style={{ aspectRatio: "16 / 9" }}>
       <iframe ... className="h-full w-full" />
     </div>
   </div>
   ```
   Käytännössä käytetään wrapper-diviä jossa `max-h` + `aspect-video`, ja iframe täyttää sen. Näin videosta jää aina tilaa tulosten näkymiselle.

2. **Tee dialogista pystyflex jossa video on kiinteä ja tulokset scrollaavat** – muutetaan `DialogContent`-luokat: `flex max-h-[90vh] flex-col gap-3 max-w-2xl` ja lisätään tulos-lohkolle `min-h-0 flex-1 overflow-y-auto`. Näin video pysyy aina ylhäällä näkyvissä, ja tulokset scrollaavat oman lohkonsa sisällä sen alla – ne eivät koskaan visuaalisesti mene videon päälle.

3. **Sama korjaus** koskee myös `PublicVideoLinkButton.tsx`:n dialogia jos siinä on sama ongelma (tässä useita videoita listalla). Käydään läpi ja lisätään samat max-korkeudet iframeihin, jottei yksi video vie koko dialogia.

## Rajaus

- Vain esitysmuutos (CSS-luokat) `src/routes/videot.tsx`-tiedostoon ja tarvittaessa `src/components/PublicVideoLinkButton.tsx`-tiedostoon.
- Ei muutoksia dataan, kyselyihin, reitteihin tai muihin sivuihin.
- Ei muutoksia korttinäkymään (grid) – vain avattuun dialogiin.
