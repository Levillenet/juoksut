## Mistä on kyse

Sivu `Joukkuekisa (kentät)` toimii esikatselussa (preview), mutta julkaistussa osoitteessa `juoksut.lovable.app` se palauttaa **404**. Tarkistus:

- `GET https://juoksut.lovable.app/print/club-team-report` → 404
- Tuotannon HTML:ssä ei ole yhtään `club-team`-viittausta — eli viimeisin julkaisu on tehty **ennen kuin** uusi reitti lisättiin.
- Selaimen konsolin virhe `Failed to fetch dynamically imported module: /assets/print-BvWOlAoJ.js` vahvistaa tämän: avoinna oleva välilehti yrittää ladata uuden reitin koodipalan, jota ei ole vanhassa julkaisussa → Tanstack Routerin `errorComponent` näyttää "Something went wrong on our end".

Koodi itse on kunnossa — preview-puolella sivu latautuu ja näyttää "Ladataan kenttälajien tuloksia…" odotetusti.

## Mitä pitää tehdä

1. **Julkaise projekti uudelleen** Lovablen Publish-toiminnolla. Tämä tuottaa uuden tuotantobuildin, jossa `/print/club-team-report`-reitti ja sen koodipala ovat mukana.
2. Julkaisun jälkeen tee selaimessa **kova päivitys** (Ctrl/Cmd + Shift + R), jotta avoinna oleva välilehti hakee uuden `index.html`:n uusilla asset-hasheilla. Vanha avoinna oleva istunto viittaa edelleen poistuneeseen `print-BvWOlAoJ.js`-tiedostoon.
3. Vahvista, että `https://juoksut.lovable.app/print/club-team-report` palauttaa 200 ja sivu avautuu.

## Koodimuutokset

Ei muutoksia. Sivu, server function ja proxy ovat jo paikallaan ja toimivat preview-ympäristössä — pelkkä julkaisu puuttuu.

<presentation-actions>
<presentation-open-publish>Julkaise sovellus</presentation-open-publish>
</presentation-actions>
