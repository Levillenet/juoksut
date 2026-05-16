## Tavoite

Tervetulodialogi näytetään kerran **kaikille** käyttäjille (myös niille, jotka ovat jo aiemmin kirjautuneet ja sulkeneet sen) seuraavan kirjautumisen yhteydessä. Lisäksi dialogin tekstiin lisätään yhteystieto kehitysasioille ja maininta datalähteestä.

## Muutokset

### 1. `src/components/WelcomeDialog.tsx` — nosta storage-versio

- Muuta `STORAGE_PREFIX = "welcome.dialog.seen.v1"` → `"welcome.dialog.seen.v2"`.
- Tämä invalidoi kaikki aiemmat "nähty"-merkinnät, joten dialogi avautuu jokaiselle käyttäjälle uudelleen yhden kerran. Sen jälkeen tallennetaan v2-avain ja dialogi pysyy taas piilossa.

### 2. `src/components/AboutServiceContent.tsx` — kaksi uutta kappaletta

Lisätään `PARAGRAPHS`-listan loppuun:

- **Datalähde:** "Järjestelmään tulevat tulokset ja tilastot haetaan live.tuloslista.com-palvelusta ja näytetään vain hieman eri käyttötarkoituksiin sopivammalla tavalla."
- **Yhteystieto:** "Järjestelmään liittyvissä kehitysasioissa voit olla yhteydessä sähköpostitse: sami.aavikko@gmail.com." Renderöidään `mailto:`-linkkinä, joten AboutServiceContent muutetaan tukemaan myös rikkaampaa sisältöä (esim. yksi kappale renderöidään JSX:nä eikä pelkkänä tekstinä).

Sama sisältö näkyy automaattisesti sekä popup-dialogissa että `/tietoa-palvelusta`-sivulla, koska molemmat käyttävät `AboutServiceContent`-komponenttia.

## Rajaukset

- Ei tietokantamuutoksia — versiointi hoidetaan pelkällä localStorage-avaimella.
- Ei muutoksia muihin reitteihin tai komponentteihin.
