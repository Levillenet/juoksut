## Tilanne

"Hyvän Tuulen Kisat 1" on tuloslistassa ID:llä **19355** — ei siis tämän päivän ID-alueella (19394–19427) kuten muut. Sen riviksi tuli `done=true, exists_in_source=false` jo **21.5.** (kuusi päivää sitten, kun kisaa ei ollut vielä syötetty tuloslistaan). Eilisen fiksi kyllä laittaisi tämän revisit-jonoon, mutta jonossa on **437 tuoretta ei-olemassaolevaa ID:tä** ja revisit-budjetti on vain 40/ajo → täysi kierros kestää ~22 min, joten 19355 ei vielä ehtinyt vuorollaan.

**Tein heti manuaalisen haravoinnin** ID:lle 19355 → 208 tulosta, 165 urheilijaa tallennettu. Lahden Ahkeran ja muiden seurojen edustajat näkyvät nyt.

## Mitä korjaan vielä

Jotta vastaavat tapaukset poimitaan jatkossa minuuteissa, ei tunneissa:

### `src/routes/api/public/hooks/harvest-results.ts`

1. **Nosta `NONEXIST_REVISIT_LIMIT` 40 → 120.**
   Täysi kierros 437 ID:n yli laskee ~22 min → ~7 min (cron pyörii 2 min välein).

2. **Priorisoi tämän päivän kisojen lähistöä.**
   Lisätään pieni lisäkysely (limit 20), joka hakee `exists_in_source=false` -rivit, joiden `competition_id` on lähellä viimeisimpiä _olemassa olevia_ tämän/eilisen päivän kisoja (±100). Näin tuoreen kisapäivän "puuttuvat" ID:t (kuten 19355 olisi ollut) skannataan joka ajossa, vaikka koko jonossa olisi satoja ID:itä.

### Manuaalinen siivous

Ei tarpeellista — uusi revisit-kysely ei suodata `done`-lipulla, joten 437 historiarivi käydään automaattisesti läpi. Ei muutoksia tietokantaan.

## Mitä EI muuteta

- Cron-aikataulua (jo 2 min)
- `NONEXIST_PERMANENT_GAP=300` ikkunaa
- Mitään käyttöliittymäkomponenttia
- Liiketoimintalogiikkaa

## Vahvistus toteutuksen jälkeen

Avaa etusivu → "Hyvän Tuulen Kisat 1" pitäisi nyt näkyä päivän kisoissa, ja seuran urheilijoissa Lahden Ahkeran edustajat (jos siellä kilpaili).
