## Tilanne

`external_competitions`-taulu on tyhjä (0 riviä). Harvest-endpoint on olemassa (`/api/public/hooks/harvest-kilpailukalenteri`) ja pg_cron-ajastus käynnistyy seuraavan kerran klo 04:00, mutta dataa ei ole vielä haettu kertaakaan.

## Ratkaisu

Laukaisen harvestin kerran manuaalisesti, jotta kisat tulevat näkyviin heti:

1. Kutsutaan `POST https://juoksut.lovable.app/api/public/hooks/harvest-kilpailukalenteri` (julkaistu URL — endpoint ei vaadi auth-headeria koska se on `/api/public/*`-prefiksin alla, mutta tarvitaan `apikey`-header jonka skripti tarkistaa).
2. Tarkistetaan `external_harvest_state` ja rivimäärä onnistumisen jälkeen.
3. Jos harvest epäonnistuu (esim. cheerio/Worker-yhteensopivuus), katsotaan worker-logit ja korjataan scraper.

Jos endpoint ei ole vielä julkaistu, käytetään esikatselu-URL:ää `project--293ee435-938e-49f8-9f0c-88f8952d582f-dev.lovable.app`.

Ei koodimuutoksia tarvita — pelkkä alkukeräyksen ajo.
