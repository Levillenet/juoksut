## Ongelma

Amanda Gustafssonin tulos kisassa 20102 (Kymenlaakson PM-huipentumat, 23.7.) ei näy, koska kyseistä kisaa ei ole skannattu tuloslistalta sitten 22.7. Kisan rivi taustatyön taulussa on `done=false`, `row_count=0`, mutta se ei koskaan pääse skannauserään.

## Juurisyy

Taustatyö (`harvest-results.ts`, run() alaosa) käy yhdellä ajolla `BATCH_SIZE=20` kisaa. Rescan-sääntö on liian löysä: `done=true` -kisat rescanataan aina, jos niiden `Date` on kolmen päivän sisällä. Tänään (24.7.) tuloslistan listalla on vähintään 22 kisaa, joiden ID on korkeampi kuin 20102 ja jotka mahtuvat rescan-ikkunaan tai eivät ole valmiita — sortti on `id DESC`, joten 20102 (indeksi 22) jää joka kerran ulos.

Todiste tietokannasta: `done=false` -jonossa on 472 vanhaa nollarivistä kisaa, ja tämän hetken API-listalta (251 kisaa, 120 "recent") 20102 on sijalla 23. Batchi 20 loppuu ennen kuin siihen päästään.

## Korjaus

Kaksi minimaalista muutosta `src/routes/api/public/hooks/harvest-results.ts`:n taustatyön skedulointiin:

1. Rescan-sääntö tiukemmaksi: `done=true` -kisa rescanataan vain, jos sen tallennettu `last_event_date` on tänään tai tulevaisuudessa (aidosti monipäiväinen ja vielä käynnissä). Eiliset ja vanhemmat kisat pysyvät ohitettuina — ne ovat vakiintuneet.
2. Priorisoi backlog: sortti `pending`-lista `last_scanned_at ASC NULLS FIRST` sen sijaan että `id DESC`. Näin pisimpään ilman skannausta olleet (kuten 20102, joka on odottanut kaksi vuorokautta) menevät jonon alkuun eivätkä jää tuoreempien alle.

Tekninen toteutus: `run()`:n taustatyö-haarassa haetaan `harvest_competitions`-taulusta jokaista listattua ID:tä varten `done`, `last_event_date` ja `last_scanned_at`, ja `pending`-listan filtteri + sortti käyttää niitä. Ei muutoksia hot cycleen, tuloslistalle lähetettävien kutsujen määrään eikä muuhun logiikkaan — vain jonon järjestys ja rescan-ehto.

## Vaikutus

- 20102 (ja muut vastaavat pitkään odottaneet ID:t) tulevat mukaan seuraavaan taustatyön ajoon.
- Yhtään ylimääräistä origin-kutsua tuloslistalle ei synny — päinvastoin, "eiliset" kisat lakkaavat rescanautumasta turhaan.
- Batch-koko pysyy samana (20/ajo).