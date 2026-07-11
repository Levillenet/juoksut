Laadin vastausviestin tuloslista.comille, jossa kerrotaan tehdyistä muutoksista. Korostetaan palvelimen reunavälimuistia (proxy + tietokantatason cache) ja kuvataan nykyinen hakumalli.

## Viestin runko (suomeksi, ei ajatusviivoja)

**Otsikko:** Päivitys: kutsujen määrä ja hakumallin muutokset

**1. Yhteenveto muutoksista**
- Poistettu kaikki "puimuripyynnöt", joissa arvattiin kilpailun ID:tä. Ainoa lähde uusille ID:ille on nyt `/live/v1/competition`.
- Vakiona käytössä yksi standardi User-Agent, ei satunnaisia selainstringejä.
- Rakennettu palvelimen reunavälimuisti (kuvattu alla), joka koalisoi rinnakkaiset pyynnöt ja palvelee useimmat lukijat ilman origin-käyntiä.
- Yökatko: kaikki taustakutsut pysähtyvät klo 21:00 ja käynnistyvät klo 09:00 Helsingin aikaa (sekä koodissa että pg_cron-aikatauluissa).
- Aktiiviseurannan ("hot cycle") ehto tiukennettu: aktivoituu vain, kun joku käyttäjä oikeasti seuraa kilpailua tai sen urheilijaa, ja vain 5 min ennen alkua kunnes 2 h alkamisen jälkeen tai kunnes päivitykset loppuvat.

**2. Palvelimen reunavälimuisti (pääosa liikenteestä)**
Kuvaus kolmen tason cachesta selaimen ja tuloslistan välillä:
- Taso 1: isolate-muisti (LRU, 500 avainta), ~1 ms vasteaika lämpimissä isolaateissa.
- Taso 2: Cloudflare Cache API per-URL, jaettu reunan sisällä (kun ajoympäristö tukee).
- Taso 3: Postgres-pohjainen varavälimuisti (`tuloslista_proxy_cache`) niitä ajoympäristöjä varten, joissa Cache API ei ole käytettävissä. Varmistaa, että taustaharvesteri ja SSR-lukijat jakavat saman rungon.
- Single-flight-koalisaatio: samanaikaiset osumat samaan URL:iin yhdistetään yhdeksi origin-pyynnöksi.
- Stale-while-revalidate: hieman vanhentunut vastaus palautetaan välittömästi, tuore versio haetaan taustalla.
- Circuit breaker: 429/503/timeout avaa katkaisijan 60 sekunniksi ja palauttaa viimeisen tunnetun tuloksen.
- Per-endpoint TTL-strategiat: kilpailulista 60 s, kisan properties 300 s, aikataulu 30 s, tulokset johdetaan Rounds-statuksesta (Progress 8 s, Official 300 s).

**3. Nykyinen hakumalli**
- **Käyttäjien pyynnöt** menevät oman domainin proxy-reitin kautta `/api/public/tuloslista/live/v1/...`, eivät suoraan tuloslistalle. Selain ei koskaan puhu suoraan originin kanssa.
- **Taustaharvesteri** ajaa 5 min välein klo 09:00 - 21:00 ja hakee vain päivän kilpailulistan, sitten kunkin listalta löytyvän aktiivisen kilpailun aikataulun ja tulokset. Ei ID-arvausta, ei 404-koettelua.
- **Hot cycle (15 s)** ajaa vain, kun päivän kilpailulla on aktiivinen seuraaja. Kilpailu tippuu automaattisesti pois heti kun tulokset loppuvat.
- **Monitor-tehtävä** tunnistaa tuloslistan rajoitusviestit vastauksen rungosta ja tallentaa ne omalle admin-näkymälle, joten reagoimme heti eikä viiveellä.
- **Lokitus:** jokainen origin-kutsu ja välimuistiosuma kirjataan `origin_call_daily`-tauluun (lähde, polkutyyppi, status). Näemme päivittäisen määrän jälkikäteen ja voimme raportoida.

**4. Mitä tämä tarkoittaa käytännössä**
- Käyttäjämäärän kasvaessa origin-kutsut eivät kasva lineaarisesti, koska proxy palvelee suurimman osan lukijoista välimuistista.
- Yöaikaan (21 - 09) origin-kutsuja ei tule lainkaan.
- Kaikki jäljellä olevat origin-kutsut ovat joko välimuistin virkistyksiä TTL:n mukaisesti tai päivän hot-kilpailun 15 s pollausta seurantakäyttäjille.

**5. Yhteydenpito**
Pyydetään ilmoittamaan, jos he näkevät edelleen epätoivottua kuormaa tai osoittamaan URL-polku, jonka he haluaisivat harvempaan tahtiin, niin säädämme TTL:n välittömästi.

## Toimitus

Kirjoitan viestin plain-text muodossa chattiin (ei koodimuutoksia), josta voit kopioida sen sähköpostiin. En koske koodiin tässä tehtävässä.
