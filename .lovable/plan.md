## Ongelma

Urheilijakortin lajikohtaisessa tulostaulukossa (`RecordsPanel.tsx`) on `overflow-x-auto`, ja kolmesta solusta jokainen käyttää `whitespace-nowrap`. Tämän takia taulukko leviää helposti leveämmäksi kuin mobiililaitteen näyttö (Samsung Fold 7, iPhone 13), jolloin "Tulos"-sarake jää piiloon oikealle ja sitä pääsee katsomaan vain rullaamalla korttia sivuttain. Kortti ei siis "skaalaudu" laitteen leveyteen.

Ratkaisu ei vaadi laitteen resoluution erillistä tunnistamista — riittää, että taulukko mitoitetaan käytettävissä olevan leveyden mukaan ja pakotetaan se mahtumaan ilman vaakasuuntaista vieritystä. Tailwindin `sm:`-breakpoint (640 px) toimii rajana mobiili vs. isompi näyttö.

## Muutokset

Vain yksi tiedosto: `src/components/RecordsPanel.tsx`.

1. **Ulompi käärintä**
   - Poista `overflow-x-auto` taulukon ympäriltä mobiilissa (`sm:overflow-x-auto` jätetään isommille näytöille turvaverkoksi).
   - Aseta `<table>`-elementille `table-fixed w-full` mobiilissa, jotta sarakkeet jakavat tilan eivätkä venytä korttia ulos näytöltä.

2. **Pvm-sarake**
   - Poista `whitespace-nowrap` mobiilissa (`sm:whitespace-nowrap`).
   - Käytä lyhyttä päivämäärämuotoa mobiilissa: `d.M.yy` (esim. "16.11.25") ja täysi `d.M.yyyy` `sm:`-näytöillä. Toteutus: lisätään toinen `Intl.DateTimeFormat` ja renderöidään pvm kahdessa spanissa (`sm:hidden` ja `hidden sm:inline`).
   - Pienennetään mobiilipaddingia (`px-2 sm:px-3`).

3. **Kilpailu-sarake**
   - Anna sarakkeen ottaa loput tilasta (`w-full` `table-fixed`-kontekstissa).
   - Säilytä `break-words`, mutta lisää `min-w-0` jotta flex/text-truncate ei pakota leveyttä.
   - Pienennetään mobiilipaddingia samoin.

4. **Tulos-sarake**
   - Poista `w-px` (joka teki sarakkeesta sisällönmittaisen ja työnsi muita ulos) ja korvaa kiinteällä minimillä: `w-[88px] sm:w-auto`.
   - Säilytä `whitespace-nowrap` itse tulosnumerolle wrapissa, mutta poista solusta, jotta badge/wind voivat rivittyä.
   - Tuuli näytetään omalla rivillä mobiilissa (jo nyt `flex-col`), mikä riittää.

5. **Sija-sarake**
   - Pysyy `hidden sm:table-cell` (ei muutosta).

6. **Otsikkorivi (kortin yläosa)**
   - Tarkistetaan että PB-badge-rivin `flex-wrap` toimii kapealla näytöllä — ei muutosta jos jo mahtuu.

Lopputulos: jokaisella mobiilileveydellä (vähintään ~320 px asti) taulukon Pvm + Kilpailu + Tulos mahtuvat samalle riville ilman vaakavieritystä. Pidemmät kilpailunimet rivittyvät, ja Tulos-sarake on aina näkyvissä.

## Mitä ei muuteta

- Ei kosketa muita urheilijakortin osioita (otsikko, tilastot, PB-yhteenveto, kilpailulistaus), koska ne käyttävät jo `grid`-pohjia ja `truncate`a eivätkä aiheuta vaakavieritystä.
- Ei lisätä JS-pohjaista resoluution tunnistusta, koska CSS-breakpointit hoitavat saman luotettavammin ja ilman hydraatio-ongelmia.
