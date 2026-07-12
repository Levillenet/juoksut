# Ongelma

Kun harvester ja hot cycle siirrettiin kulkemaan sisäisen proxyn (`/api/public/tuloslista/...`) kautta reunavälimuistin hyödyntämiseksi, niiden kutsut kirjautuvat `origin_call_daily`-taulussa lähteillä `proxy_origin` (miss) ja `proxy_cache` (hit) sen sijaan että näkyisivät omilla lähteillään `harvester` / `hot_cycle`. Admin-dashboardilla tämä näyttää harhaanjohtavasti siltä että "harvester ei ole hakenut mitään tänään", vaikka se toimii normaalisti.

Todiste: 12.7. `proxy_origin` sisältää 604 schedule- ja 127 results-kutsua, jotka ovat käytännössä harvesterin/hot cyclen työtä.

# Ratkaisu

Välitetään todellinen alkuperäinen lähde proxylle otsakkeessa `x-origin-source` ja luetaan se `bumpOriginCall`-kutsussa proxyn sisällä. Näin admin-taulukossa näkyy taas erikseen:

- `harvester` = taustaharvesterin ajot (miss + hit)
- `hot_cycle` = 15 s pollaus
- `proxy_origin` / `proxy_cache` = pelkästään loppukäyttäjien selainpyynnöt

## Muutokset

1. **`src/lib/tuloslista-proxy.ts`**
   - Lue pyynnöstä `x-origin-source`-otsake (arvo yksi `CounterSource`-tyypeistä: `harvester` | `hot_cycle` | `monitor` | `admin_probe`).
   - Jos otsake on annettu:
     - Miss → `bumpOriginCall(source, path, status)` (ei `proxy_origin`).
     - Cache hit → `bumpOriginCall(source, path, "hit")` + `bumpOriginCall("proxy_cache", path, "hit")` (säilytetään reunavälimuistin säästö-tilasto ennallaan, mutta lasketaan myös alkuperäiselle lähteelle jotta kokonaismäärä täsmää).
     - Vaihtoehto: pelkkä alkuperäinen lähde, ilman `proxy_cache`-riviä. Suositellaan tätä, koska admin-UI:n Säästö-sarake lasketaan `proxy_cache / (proxy_cache + proxy_origin)` — jätetään `proxy_cache` mittaamaan vain aitoja selainpyyntöjä.
   - Jos otsaketta ei ole → nykyinen käyttäytyminen (`proxy_origin` / `proxy_cache`).

2. **`src/routes/api/public/hooks/harvest-results.ts`**
   - Kaikkiin `fetch`-kutsuihin sisäiseen proxyyn lisää `headers: { "x-origin-source": "harvester" }` (tai `"hot_cycle"` hot-syklin funktioissa).

3. **Poista päällekkäinen instrumentointi**
   - Harvesterissä on jo `bumpOriginCall("harvester", ...)`-kutsuja upstream-vastauksen jälkeen. Kun proxy kirjaa saman kutsun `x-origin-source`-otsakkeen perusteella, tuloksena syntyy tuplakirjauksia. Poista harvesterin sisäiset `bumpOriginCall`-kutsut niiltä poluilta jotka kulkevat proxyn kautta, jätä vain suorille upstream-kutsuille (jos jäljellä yhtään).

4. **Admin-dashboardin selite**
   - `/admin/tuloslista-probe`-sivulle pieni legenda tai tooltip lähteille: `harvester` = taustaharvesteri, `hot_cycle` = 15 s pollaus seuratuille kilpailuille, `monitor` = 10 min terveystarkkailu, `proxy_origin` = käyttäjän selainpyyntö reunavälimuistin ohitse, `proxy_cache` = käyttäjän selainpyyntö palveltu reunavälimuistista, `admin_probe` = admin-UI:n käsintestaus.

## Tarkennus: mitä sivutuotteita korjaus tuo

- 12.7. luvut näyttävät jatkossa jotain kuten `harvester: ~700, hot_cycle: ~50, proxy_origin: ~30, proxy_cache: ~100` sen sijaan että kaikki on `proxy_origin`.
- Säästö-% pysyy relevanttina (mittaa vain käyttäjäliikennettä).
- Historia 12.7. asti (ennen deploytä) jää edelleen näkymään `proxy_origin`-lähteellä, mikä on ok.

# Ei muutoksia

- Ei muutoksia harvesterin logiikkaan, ajastuksiin, hot-syklin sääntöihin eikä välimuistin toimintaan.
- Ei muutoksia tietokantaskeemaan (`origin_call_daily` säilyy ennallaan).
