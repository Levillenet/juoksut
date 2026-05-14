## Tavoite

Kuuluttajan näkymän **Seuraavaksi**-paneelissa juoksulajien (Category === "Track") avattu rivi näyttää tällä hetkellä kaikkien erien kilpailijat yhtenä litteänä listana. Halutaan, että erät näkyvät erikseen (Erä 1, Erä 2, …) ja jokaisen erän alla on oma rata-/sijoitusjärjestys ja tulokset, samaan tapaan kuin täydessä `/round/...`-näkymässä.

Kenttälajeissa (Field) erä-käsite ei ole sama, joten niissä säilytetään nykyinen yhdistetty näkymä.

## Muutokset

### `src/routes/announcer.tsx` — `UpcomingItem`

1. Käytetään suoraan `detail.Rounds[].Heats`-rakennetta `flattenAllocations`in sijaan, kun `round.Category === "Track"` ja erien määrä > 1.
2. Etsitään `detail`ista se `Round`, jonka `Id === round.Id` (yksi event voi sisältää useita kierroksia, esim. alkuerät + finaali).
3. Renderöidään kunkin `Heat`in alle pieni otsikko (esim. "Erä {heat.Index}" + mahdollinen aloitusaika jos eroaa) ja sen alle nykyisen tyylinen `<ol>` allokaatioista.
4. Allokaatioiden järjestys erän sisällä:
   - Jos jollain on `ResultRank`, järjestetään `ResultRank`in mukaan.
   - Muuten `Position` (= ratanumero) mukaan.
5. Kenttälajit ja yksieräiset juoksut: nykyinen flatten-lista säilyy.
6. Tulos-/PB-/SB-rivin renderöinti (mukaan lukien `RecordBadge` + `effectiveRecord`) puretaan pieneen sisäiseen `AllocationRow`-komponenttiin, jotta sekä eräryhmittely että flatten-haara käyttävät samaa esitystä.

### Mitä ei muuteta

- Datalähteet, queryt, baseline-logiikka, muut paneelit (Käynnissä, Lopputulokset).
- Yläosan ennätys-banner.
- `EventCard` (Käynnissä-paneeli) — siellä top-3 / kaikki riittävät, eräjako ei ole olennainen kuuluttajalle live-tilanteessa. Voidaan tehdä myöhemmin erikseen jos halutaan.

## Lopputulos

Kuuluttaja näkee "Seuraavaksi"-listalla esim. 100 m miehet auki ja erottaa heti, ketkä ovat erässä 1, 2, 3, ja näkee jo valmistuneiden erien tulokset eräkohtaisesti.
