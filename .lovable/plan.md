## Joukkuekisaraportti (kenttälajit)

Uusi tulostettava raportti, joka näyttää valitun kisan **kaikkien kenttälajien joukkuekilpailun tulokset**: jokaisen seuran kahden parhaan urheilijan paras tulos kolmesta ensimmäisestä kierroksesta summattuna.

### Toiminta

1. Käyttäjä avaa "Seuran kisaraportti" → uusi välilehti "Joukkuekisa (kentät)" → valitsee kisan.
2. Raportti listaa **kaikki kenttälajit ikäluokittain** (kuula, kiekko, keihäs, moukari, pituus, korkeus, kolmiloikka, seiväs).
3. Jokaisen lajin alla seurat järjestyksessä parhaan yhteistuloksen mukaan:
   - Sij. | Seura | Yhteistulos (kahden parhaan summa)
   - Sisennettynä molemmat urheilijat: nimi | sijoitus lajissa | paras tulos (3 ensimmäisestä kierroksesta)
4. Print-painike (A4, pysty/vaaka, PDF-export).

### Datalähde

Kierrostulokset eivät ole tietokannassa, joten ne haetaan **lennossa** `live.tuloslista.com`:n julkisesta JSON-rajapinnasta — sama lähde mitä haravoija jo käyttää (`supabase/functions/harvest-tuloslista`). Endpointit varmistetaan haravoijan koodista ennen toteutusta.

Jokaisen lajin tuloksista poimitaan kullekin kilpailijalle attempts[0..2], suodatetaan hylätyt (`x`, `-`), ja otetaan max. Korkeudessa/seipäässä: korkein ylitetty korkeus kolmen ensimmäisen attemptin aikana.

### Toteutus

**Uusi server function** `src/lib/club-team-report.functions.ts`:
- `getClubTeamReport({ competitionId })` → palauttaa `{ events: [{ ageClass, eventName, clubs: [{ rank, club, total, athletes: [{ name, eventRank, best3 }] }] }] }`.
- Hakee competition info + race-tulokset rinnakkain, suodattaa kenttälajit (`sub_category` jump/throw), parsii attempts, ryhmittelee seuroittain, valitsee kaksi parasta per seura, järjestää.

**Uusi reitti** `src/routes/print.club-team-report.tsx`:
- Lukee `?competitionId=`, kutsuu server fn:ää (TanStack Query), renderöi taulukot lajeittain. Sama visuaalinen tyyli kuin `print.club-report.tsx`:ssä.

**Päivitykset**:
- `src/components/PrintTabs.tsx`: lisää välilehti "Joukkuekisa (kentät)".
- `src/routes/index.tsx`: "Seuran kisaraportti" -kortti johtaa uuteen näkymään (tabit erottavat raporttityypit).

### Reunaehdot

- Jos kisaa ei enää ole `live.tuloslista.com`:ssa, näytetään selkeä virheilmoitus.
- Vain kenttälajit; rata ja moniottelut jätetään pois.
- Tasatuloksissa toissijainen ratkaisija = lajisijoitusten summa.
- Seuran tulos lasketaan vain jos seurassa on vähintään 2 kilpailijaa lajissa; muut näytetään listan lopussa "ei joukkuetta".
