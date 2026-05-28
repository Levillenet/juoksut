# Tiivistetty tulostus: Kilpailun aikataulu

Muutokset koskevat vain `/print` -sivun **tulostusnäkymää** (`@media print`). Ruudulla näkyvä versio pysyy ennallaan.

## Ongelmat nyt
1. **Tyhjä ensimmäinen sivu** — sticky-header (`position: sticky` + `backdrop`) ja suodatinkortti vievät tilaa myös tulostuksessa, vaikka `print:hidden` piilottaa ne. Tausta-`backdrop` ja `main`-paddingit jättävät silti pystytilaa → ensimmäinen sivu jää käytännössä tyhjäksi.
2. **Yksi laji per rivi** koko leveydellä → paljon hukkatilaa, monta sivua.
3. Päivä-otsikot ja `Name` -alarivi vievät turhan paljon korkeutta.

## Ratkaisu

### 1. Kahden sarakkeen tulostusasettelu (CSS columns)
Käytetään CSS `column-count: 2` -ominaisuutta `<main>`-elementissä **vain tulostuksessa**. Tällöin:
- Selain täyttää ensin vasemman sarakkeen ylhäältä alas, sitten oikean → luonteva lukujärjestys.
- Päiväosiot (`<section>`) saavat `break-inside: avoid` ettei päivä katkea sarakkeen keskellä, mutta jos päivä on isompi kuin sarake, se saa silti katketa rivin kohdalta (rivit on jo `tr { page-break-inside: avoid }`).
- 109 lajia mahtuu arviolta **2–3 A4-sivulle** aiemman 5–6 sijaan.

### 2. Tiiviimpi typografia tulostuksessa
- Perusfonttikoko `10pt` (nyt 14–16px → ~11pt) ja `line-height: 1.25`.
- Aikasarake `width: 3.2em`, kellonaika lihavoitu, lajinimi tavallinen.
- Yhdistetään `EventName` + `Name` samalle riville: `1500 m · M16 alkuerä 2` muodossa. Nykyinen kaksirivinen rakenne puolittuu.
- Pienempi `<h2>` päivä-otsikko (12pt, ohuempi alaviiva), `margin-top: 0` ensimmäisellä.

### 3. Sivunhallinta
- `@page { size: A4; margin: 10mm 10mm 12mm 10mm; }` — kapeammat marginaalit.
- `main { padding: 0 !important; }` ja `header { display: none }` tulostuksessa → poistaa tyhjän ensisivun.
- Tulostusotsikko (kisan nimi + päivä) pysyy yhden rivin korkuisena yläreunassa.
- Alaviite `Lähde: …` vain viimeisellä sivulla luonnollisesti.

### 4. Suodatin: pidetään
"Vain juoksulajit / Kaikki lajit" -valinta toimii kuten ennen. "Kaikki lajit" hyötyy 2-sarakkeesta eniten.

### Ei kirjasta (booklet) tässä vaiheessa
Booklet (taitettava A5-kirjanen) vaatisi sivujen järjestelyä (1,4 | 2,3 …) jota selainten tulostus ei natiivisti tee — pitäisi generoida PDF palvelinpuolella. Jätetään tämän vaiheen ulkopuolelle; mainitsen jos haluat sen myöhemmin erillisenä toteutuksena.

## Tekniset muutokset

**Tiedostot:**
- `src/styles.css` — laajennetaan `@media print`-lohkoa: `@page`, `column-count: 2`, kompaktit fontti- ja marginaalisäännöt luokalla esim. `.print-schedule`.
- `src/routes/print.index.tsx` — lisätään `print-schedule` -luokka `<main>`-elementtiin ja yhdistetään `EventName` + `Name` samalle riville (yksi `<td>`). Otsikkoblokki (`hidden print:block`) pysyy mutta tiivistetään.

Ei muutoksia muihin reitteihin (`print.club`, `print.watched`) ellet halua saman kohtelun myös niille — kerro jos halutaan.

## Lopputulos
- Ei tyhjää ensisivua.
- ~2–3 sivua aiemman 5–6 sijaan.
- Selkeä, helppolukuinen kaksipalstainen aikataulu A4:lle.
