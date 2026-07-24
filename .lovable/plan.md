Tavoite: kun kuuluttajanäkymä (tai kuka tahansa käyttäjä) hakee tuloksen tuloslistalta, samaa vastausta käytetään kaikille muillekin käyttäjille. Origin-palvelimelle tehdään korkeintaan yksi kutsu kutakin tulosta kohden välimuistin ollessa voimassa.

Nykytila
--------
- Kaikki tuloslista-kutsut kulkevat `/api/public/tuloslista/live/v1/*`-proxyreittien kautta (`src/lib/tuloslista.ts`).
- Proxyssa on kolme tasoa: isolaatin muisti, Cloudflare Cache API ja Postgres-fallback (`tuloslista_proxy_cache`).
- Single-flight koalisoi rinnakkaiset pyynnöt yhdeksi origin-kutsuksi saman isolaatin sisällä.
- TTL: käynnissä oleva laji 3 s tuoreena + 7 s stale-while-revalidate, virallistunut 300 s + 3600 s.
- Aukot:
  1. Cloudflare Cache API -avain riippuu pyynnön origin-domainista, joten preview/localhost/tuotanto eivät jaa samaa cachea.
  2. Postgres-cache on vasta varatier, ei ensisijainen jaettu lähde.
  3. Single-flight ei ylitä Worker-isolaattien rajaa; cache-missin yhteydessä useat isolaatit voivat tehdä saman origin-kutsun lähes yhtä aikaa.
  4. Harvester voi kutsua originia suoraan, jolloin tulos ei välity proxyvälimuistiin.

Suunnitelma
-----------
1. Yhtenäistä cache-avain kaikille domaineille
   - Poista cache-avaimesta pyynnön origin-domain. Käytä aina kanonista avainta, esim. `https://tulokset.online/__tl-proxy{path}` riippumatta siitä, mistä domainista pyyntö tulee.
   - Säilytä erilliset avaimet vain tarvittaessa (ei tässä tapauksessa).

2. Nosta Postgres-cache ensisijaiseksi jaetuksi välimuistiksi
   - Muuta `proxyTuloslista` tarkistamaan `tuloslista_proxy_cache` ennen isolaattimuistia ja Cloudflare Cache API:a.
   - Jos DB:stä löytyy tuore (edgeTtl) tai stale (edgeTtl+swrWindow) vastaus, palauta se välittömästi ja tee taustapäivitys vain jos stale.
   - Kirjoita jokainen onnistunut origin-vastaus DB:hen heti fetchin jälkeen.
   - Lisää DB-kirjoituksiin `updated_at`-indeksi ja ajoittainen pruning (jo olemassa).

3. Lisää cross-isolate single-flight DB:n avulla
   - Lisää `tuloslista_proxy_cache`-tauluun `locked_until`-kenttä tai erillinen `tuloslista_proxy_fetch_locks`-taulu.
   - Ennen origin-kutsua yritä ottaa lukko avaimella `path`. Jos joku muu on jo hakemassa samaa tulosta, odota lukon vapautumista ja palauta sitten DB:stä saatu arvo.
   - Vapauta lukko ja päivitä cache, kun origin-vastaus saapuu (tai aikakatkaisu/virhe).
   - Aseta lukolle maksimikesto (esim. 10 s), jottei virhe jätä pysyvää lukkoa.

4. Pakota harvester ja hot cycle proxyyn
   - Muuta harvester (`src/routes/api/public/hooks/harvest-results.ts`) ja monitor (`monitor-tuloslista.ts`) käyttämään aina omaa proxyreittiä eikä koskaan suoraan `cached-public-api.tuloslista.com`-originia.
   - Käytä `x-origin-source`-headeria, jotta kutsut kirjautuvat edelleen oikein `origin_call_daily`-laskuriin.
   - Tämä varmistaa, että taustatyön hakemat tulokset ovat välittömästi kaikkien käyttäjien saatavilla samasta jaetusta cachesta.

5. Esilämmitä ja pidennä virallistuneiden tulosten TTL
   - Kun harvester tallentaa tuloksen ja status on `Official`, aseta DB-cachen `edgeTtl` vähintään 1 tunniksi ja `swrWindow` useiksi tunneiksi.
   - Käynnissä oleville lajeille säilytä lyhyt 3–5 s TTL, mutta varmista, että harvesterin tiheä hot cycle pitää cachen jatkuvasti tuoreena.

6. Lisää näkyvyyttä ja varmista toimivuus
   - Lisää admin-näkymään reaaliaikainen lukema: kuinka monta origin-kutsua on tehty viimeisen 5 minuutin aikana ja kuinka suuri osa palveltiin cachesta.
   - Lisää yksikkötestit proxy-funktiolle simuloimalla useita rinnakkaisia pyyntöjä ja varmista, että origin-kutsuja syntyy vain yksi.
   - Kirjaa proxy-virheet ja pitkät viiveet lokiin, jotta voidaan havaita, jos single-flight pettää.

Tekniset tiedot
---------------
- Tiedostot, joihin kosketaan:
  - `src/lib/tuloslista-proxy.ts` (cache-järjestyksen ja single-flightin muutos)
  - `src/lib/tuloslista.ts` (varmistetaan, että kaikki kutsut kulkevat proxyn kautta)
  - `src/routes/api/public/hooks/harvest-results.ts` (vain proxy-käyttö)
  - `src/routes/api/public/hooks/monitor-tuloslista.ts` (vain proxy-käyttö)
  - `src/lib/tuloslista-probe.functions.ts` (vain proxy-käyttö)
  - `supabase/migrations/` (uusi migraatio lukkotaululle ja mahdollisesti cache-taulun päivitys)
  - `src/routes/admin.tuloslista-probe.tsx` tai vastaava (cache/osuma-analytiikka)

- Rajoitukset ja huomiot:
  - Tämä ei poista kaikkia origin-kutsuja: käynnissä oleviin lajeihin tarvitaan edelleen säännöllisiä päivityksiä. Tavoite on välttää turhat duplikaattikutsut.
  - DB:n käyttö ensisijaisena cachena lisää latenssia muutamalla millisekunnilla, mutta säästää merkittävästi origin-kuormaa.
  - Lukkoratkaisu täytyy tehdä idempotentiksi, jottei Workerin kaatuminen jätä pysyvää lukkoa.

Seuraavat askeleet
------------------
1. Hyväksy tämä suunnitelma.
2. Toteutan migraation lukkotaululle/cache-päivitykselle.
3. Päivitän proxyn käyttämään DB:tä ensisijaisena jaettuna välimuistina.
4. Pakotan harvesterin/monitorin proxyyn.
5. Lisään admin-näkymään cache-osuuden ja testit.
6. Testaan tuotantoa vastaavalla kuormalla ja tarkistetaan origin-kutsujen määrä.