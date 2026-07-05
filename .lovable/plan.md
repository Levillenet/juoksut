## Juurisyy

N15 100m alkuerät on `Status: "Official"` ja kaikki erät valmiit, joten se päätyy **Lopputulokset**-osioon. Siellä käytetään `UpcomingItem`-komponenttia (ei `EventCard`), ja `CompletedSection` välittää `groupHeats={false}`, mikä pakottaa alkuerätkin näkymään yhtenä litteänä listana. Aiemmin muokkaamani `EventCard`in eräkohtainen haara ei siis vaikuta lopputulokset-listaan.

## Korjaus

1. **`src/components/announcer/CompletedSection.tsx`**
   - Importoidaan `isHeatRound` `@/lib/tuloslista`sta.
   - `UpcomingItem`ille annetaan `groupHeats={isHeatRound(r)}` `false`n sijaan. Näin alkuerät renderöityvät eräkohtaisina, mutta finaalit/kenttälajit säilyvät nykyisenä yhtenä listana.

2. **`src/components/announcer/shared.tsx` — `UpcomingItem`in eräryhmittelyhaara**
   - Nykyisessä haarassa `AllocationRow`lle annetaan `showRank={heatHasResults ? "result" : "position"}`. `result` käyttää `ResultRank`ia (kokonaissijoitus koko lajissa), mikä on alkuerissä harhaanjohtavaa. Vaihdetaan alkuerärenderöinnissä `"heat"`-tilaan (käyttää `HeatRank`ia). Toteutus: kun `isHeatRound(round)`, käytetään `"heat"`, muuten säilytetään nykyinen `"result"`. Sortataan erän sisällä `HeatRank`illa kun tulokset ovat tulleet.

3. **Ei muutoksia** `useAnnouncerData`iin, `EventCard`iin eikä muihin osioihin.

### Verifiointi

- Kouvola Games (kisa 19719), N15 100m alkuerät: Lopputulokset-osiossa kortti aukeaa ja näyttää "Erä 1" ja "Erä 2" omina taulukoina rata- tai HeatRank-järjestyksessä, ei yhtä 11 hengen yhteislistaa.
- Loppukilpailu (kun se on ohi): näkyy nykyiseen tapaan yhtenä 1–8 listana.
- Käynnissä olevat alkuerät: EventCard-heat-mode toimii aiemman toteutuksen mukaisesti.
