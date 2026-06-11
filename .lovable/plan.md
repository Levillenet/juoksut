# Tavoite

Kun urheilijan erää **ei ole vielä julkaistu** tuloslistassa (entry `heatIndex === 0`), älä toista urheilijaa jokaisella saman lajin erä-rivillä. Näytä urheilija **kerran** ja listaa rivillä koko lajin calling-aikataulu (kaikki erien calling-ajat ja erä-numerot PDF:n mukaan).

Kun erä **on julkaistu** (`heatIndex > 0`), näytä urheilija vain hänen omalla erärivillään kuten nyt.

# Muutokset

## 1. `src/lib/yag-calling-match.ts`

Muuta paluutyyppi ja matchausta niin että jokainen entry merkitään joko *julkaistuksi* (sidottu yhteen erään) tai *julkaisemattomaksi* (sidottu lajiin, ei yksittäiseen erään).

Uusi tyyppi:

```ts
export interface YagCallingMatch {
  row: YagCallingRow;          // edustava rivi (julkaisemattomille = lajin 1. erä)
  heatNumber: number | null;   // julkaistuille erä; julkaisemattomille null
  entries: IndexedEntry[];     // urheilijat tällä rivillä
  // Vain julkaisemattomille: koko lajin kaikkien erien calling-tiedot
  allHeats?: Array<{ heat: number | null; calling: string; alkaa: string; kentalle: string; paikka: string }>;
}
```

Logiikka:
1. Ryhmittele PDF-rivit lajiavaimella `${date}|${sarja}|${disc}` → `heatRows[]`.
2. Ryhmittele entryt samalla avaimella.
3. Jokaiselle lajiryhmälle:
   - **Julkaistut entryt** (`heatIndex > 0`): jaa heatRow-riveille `heatIndex === parseHeat(row.laji)` mukaan kuten nyt.
   - **Julkaisemattomat entryt** (`heatIndex === 0`): laita kaikki **yhdelle** matchille jonka `row` = lajin ensimmäinen erärivi (varhaisin calling-aika), `heatNumber = null`, `allHeats` = kaikkien lajin erärivien calling/alkaa/erä-tiedot aikajärjestyksessä.
   - Jos lajilla on PDF:ssä vain yksi rivi (ei erä-merkintää), käyttäydy kuten nyt — ei muutosta.

## 2. `src/routes/print.yag-calling.tsx`

`tbody`-rendauksessa:
- Jos `m.heatNumber != null` → näytä erä-sarakkeessa numero kuten nyt.
- Jos `m.allHeats` on annettu → erä-sarakkeessa lyhyt teksti `Erät 1–N (ei vielä julkaistu)` ja **Calling**-sarakkeessa pinottu lista kaikkien erien calling-ajoista, esim.

  ```
  09:30  Erä 1
  10:00  Erä 2
  10:30  Erä 3
  ```

  Vastaavasti **Kentälle**/**Alkaa**-sarakkeet pinotaan (tai näytetään ensimmäisen erän aika ja merkintä "+ N erää"). Käytetään pinottua listaa, jotta käyttäjä näkee kaikki erien ajat.
- Ryhmittelyssä (`grouped`) julkaisemattoman matchin lajitteluavain = sen edustavan rivin `calling`-aika (= varhaisin), jolloin se sijoittuu päivän aikajärjestykseen.

## 3. Ei muutoksia

`src/data/yag-calling.ts`, `print.club`, `print.watched`, navigaatio.

# Tekninen huomio

`heatIndex` tulee tuloslistasta: jos eräjako on julkaistu, jokainen entry on sidottu erään. Saman urheilijan voi olla useissa lajeissa, joten ryhmittely tehdään lajiavaimella eikä urheilijakohtaisesti — sama urheilija voi siis edelleen näkyä esim. pituushypyn yhdellä rivillä ja 100m:n yhdellä rivillä.
