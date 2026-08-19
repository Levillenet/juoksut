# Lovable AI- ja Cloud-käytön tarkistus

## Mitä mittasin

Kuluvan laskutusjakson (29.7. alkaen) kulutus on 197 krediittiä:

| Erä | Krediitit | Osuus |
| --- | --- | --- |
| Build-tilan viestit | 131,6 | 67 % |
| Plan-tilan viestit | 31,0 | 16 % |
| Cloud compute (pico + micro) | 31,9 | 16 % |
| Cloud functions, worker, egress, storage | 2,8 | 1 % |

Havainnot:

- Lovable AI (tekstimallit, kuvat) ei ole käytössä lainkaan: koodista ei löydy yhtään AI Gateway -kutsua. AI ei siis kuluta mitään.
- Selvästi suurin kuluerä (83 %) on agentin kanssa keskustelu, ei sovelluksen ajonaikainen käyttö.
- Cloud-puolen kulu on käytännössä kokonaan tietokannan compute-aikaa, noin 1,5 krediittiä/vrk. Se on kohtuullinen, mutta siinä on siivottavaa.

Tietokannan tila: 470 MB, levy 52 % käytössä, muisti 52 %, yhteydet 16/60 (matala).

## Löydetyt turhat kuormat

1. `tuloslista_proxy_cache`: 9 758 riviä, 42 MB, joista 9 200 on yli tunnin vanhoja eli kuolleita. Vanhin rivi 11.7. Välimuistia ei siivota koskaan.
2. `athlete_results`: 422 892 riviä (282 MB), joista 119 662 on yli 400 vrk vanhoja. Nämä kasvattavat levyä ja hidastavat PB-laskentaa.
3. `analytics_events`: 1 867 riviä yli 90 vrk vanhoja, ei säilytyspolitiikkaa.
4. Cron-ajot pyörivät jatkuvasti myös yöllä ja kaudella jolloin kisoja ei ole: `harvest-tuloslista` 5 min välein, `harvest-hot-15s` 5 min välein, `tuloslista-monitor` 10 min välein. Vaikka ne poistuvat nopeasti, ne herättävät kannan ~500 kertaa vuorokaudessa.
5. Kanta on kirjannut 23 953 peruuntunutta transaktiota ja 7 lukkiumaa käynnistyksen jälkeen, mikä viittaa siihen että lukkokilpailua syntyy edelleen jonkin verran (todennäköisesti harvest/proxy-lukot).

## Ehdotetut toimenpiteet

### 1. Automaattinen siivous (suurin hyöty, pieni riski)

Uusi migraatio, joka lisää päivittäisen cron-siivouksen:
- poistaa `tuloslista_proxy_cache` -rivit joiden `cached_at < now() - 1 hour`
- poistaa `analytics_events` -rivit yli 180 vrk vanhat
- poistaa `origin_call_path_daily` -rivit yli 90 vrk vanhat
- poistaa `tuloslista_probe_log` -rivit yli 30 vrk vanhat

Vaikutus: noin 45 MB heti pois, kanta pysyy tasapainossa jatkossa.

### 2. Cron-ajojen rauhoitus hiljaisina aikoina

- `harvest-tuloslista` ja `harvest-hot-15s` ajetaan vain klo 07-23 Helsingin aikaa (yöllä ei tule tuloksia).
- `tuloslista-monitor` 10 min -> 30 min.

Vaikutus: noin 40 % vähemmän taustaherätyksiä ja vähemmän compute-aikaa, ei näy käyttäjälle.

### 3. Vanhojen tulosten arkistointi (valinnainen, päätä erikseen)

`athlete_results` yli 400 vrk vanhat rivit (119 662 kpl) voi joko säilyttää sellaisenaan tai siirtää kevyempään arkistotauluun. Ne ovat tarpeen ennätysvertailussa, joten en poistaisi niitä ilman erillistä päätöstä. Kevyempi vaihtoehto: varmistetaan että PB- ja ennätyslaskenta osuu indeksiin eikä lue koko taulua.

### 4. Krediittien käyttö keskustelussa

Suurin säästö ei ole koodissa vaan työtavassa: kerää useampi muutos yhteen viestiin ja käytä plan-tilaa vain isoille kokonaisuuksille. Yksi build-viesti maksaa moninkertaisesti sen mitä sovellus kuluttaa vuorokaudessa.

## Tekniset yksityiskohdat

- Siivous tehdään `pg_cron`-työnä suoraan SQL:llä, ei uutta endpointia.
- Cron-aikaikkuna toteutetaan cron-lausekkeella UTC:ssä (04-20 UTC vastaa 07-23 Helsinki kesäaikaa) ja lisäksi tarkistus funktiossa, ettei kesä/talviaika riko rajoja.
- Ei muutoksia harvest-logiikkaan eikä proxy-TTL-arvoihin, koska ne on jo optimoitu aiemmin.
