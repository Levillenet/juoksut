## Mitä rakennetaan

Urheilijan profiilisivulle (`/athlete/$key`) lisätään jokaisen kilpailutuloksen viereen pieni merkintä, joka kertoo:

- **Voimassa oleva kauden kärki** – vihreä "Kauden 1." merkki, jos tulos on edelleen kuluvan kauden paras Suomessa kyseisessä lajissa + ikäluokassa.
- **Aiempi kauden kärki** – kullanvärinen "Oli kauden 1." merkki + voimassa olevan kärjen aika ja nimi, jos tulos oli sen kilpailupäivänä kauden paras mutta on sittemmin ohitettu.
- **Ei merkintää**, jos tulos ei ole koskaan ollut kauden kärjessä tai ei kuulu kuluvaan kauteen.

Vertailu: koko Suomen tulokset, sama normalisoitu lajinimi (`normalize_event_name`) + sama `age_class`. Kausi määritetään automaattisesti tuloksen `competition_date`:sta käyttäen olemassa olevaa `seasonRange`-logiikkaa (ulko/halli). Vain top 1.

## Tekninen toteutus

1. **Uusi apuri** `src/lib/season-top.ts`:
   - `loadAthleteSeasonTopFlags(athleteKey)` -funktio, joka palauttaa `Map<resultId, { wasLeader: boolean; isCurrent: boolean; current: { resultText, resultNumeric, athleteName, competitionDate } | null }>`.
   - Hakee ensin urheilijan tulokset (sama lähde kuin `fetchStoredHistory`).
   - Ryhmittelee uniikit `(season, normalisoitu event, age_class)` -avaimet.
   - Kullekin avaimelle yksi kysely `athlete_results`-tauluun: hakee kauden kaikki rivit tälle (event + age_class) kombolle (käyttäen `competition_date` between season-range, normalisoidaan client-puolella). Riittävä kun limit korkea, koska ikäluokka+laji rajaa määrän pieneksi.
   - Laskee:
     - `currentBest` = paras tulos kaudella (track: pienin aika, muut: suurin),
     - kullekin urheilijan riville: oliko sen tulos paras kaikkien ennen-tai-samana-päivänä rivien joukossa (sama lajitteluvertailija `isTrackBetter`).
   - Tulos: `wasLeader = true` jos sen ajan jälkeen on tullut parempi mutta omana hetkenään oli paras; `isCurrent = true` jos = currentBest.

2. **Athlete-sivun integrointi** (`src/routes/athlete.$key.tsx`):
   - Toinen `useQuery(["athlete-season-top", key])` joka kutsuu uutta apuria.
   - Välitetään `Map` `EventGroupView` / `CompetitionResultRow`-komponenteille (joko propsina tai contextina). `CompetitionResultRow`:ssa renderöidään `result_text`-elementin viereen pieni badge.

3. **Badget** (Tailwind, semanttiset tokenit):
   - Voimassa: `bg-emerald-500/15 text-emerald-700` + Trophy-ikoni, teksti "Kauden 1.".
   - Aiempi: `bg-amber-500/15 text-amber-700` + Trophy, teksti `Oli kauden 1. · nyt 9,12 Etunimi S.`. Hover-tooltipissä kilpailupvm.

## Suorituskyky

- Useimmilla urheilijoilla on 5–30 uniikkia (laji+ikäluokka)-kombinaatiota; tehdään yksi kysely per kombinaatio rinnakkain `Promise.all`-pakettina. Rajataan `result_numeric not null` ja `age_class = X`, käytetään existing index-ystävällisiä sarakkeita.
- Cache `staleTime: 60_000` riittää. Profiilisivun nykyinen kysely säilyy ennallaan.

## Mitä EI tehdä tässä

- Top 3 / aiempien kausien tukea ei lisätä (voi tulla myöhemmin).
- Watch-sivulle / season-leaders-sivulle ei kosketa.
- DB-skeemaan ei kosketa.
