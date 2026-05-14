## Tavoite

Käynnissä-paneelin kenttälaji-korteissa näkyy jokaisen kilpailijan rivillä kuinka monta suoritusta hän on jo tehnyt (esim. pituus 3/6). Näin kuuluttaja näkee yhdellä silmäyksellä, kuka on ehtinyt mihinkin kierrokseen.

## Muutokset

### 1. Tyyppi: `src/lib/tuloslista.ts`

Lisätään API-vastauksen mukainen kenttä `Allocation`-tyyppiin:

```ts
Attempts?: { Line1: string | null }[];
```

(API palauttaa Attempts-taulukon kenttälajeille; muut tiedot jätetään koskematta.)

### 2. UI: `src/routes/announcer.tsx` → `EventCard`

Vain kun `round.Category === "Field"`:

- Lasketaan `attemptsDone = a.Attempts?.length ?? 0`.
- Näytetään tulos-/SB-arvon vieressä pieni tunnus, esim.:
  - normaali kenttä (pituus, kuula, keihäs, kiekko, moukari, kolmiloikka): `3/6` (kun `attemptsDone < 6`) tai pelkkä numero kun lopussa
  - korkeus & seiväs (`SubCategory === "HighJump" | "PoleVault"`): pelkkä `3 yrit.` (yritysten kokonaismäärä vaihtelee, ei kiinteää maksimia)
- Tunnus näytetään `text-xs text-muted-foreground tabular-nums` -tyylillä, jotta ei kilpaile itse tuloksen kanssa.
- Näkyy sekä suljetussa top3-näkymässä että avatussa täydessä listassa.
- Ei muutoksia juoksulajeihin (Track) eikä Lopputulokset-/Seuraavaksi-paneeleihin.

### Mitä ei muuteta

- Datalähteet, queryt, statuslogiikka, ennätyslogiikka, `UpcomingItem`.
- API-kutsut: `Attempts` tulee jo nykyisellä `fetchEvent`-kutsulla; vain TS-tyyppi laajenee.

## Lopputulos

Käynnissä-paneelin kenttälajikortissa jokaisen rivin oikeassa laidassa näkyy esim. `5,42  3/6` tai korkeudessa `175  4 yrit.`, joten kuuluttaja näkee suoraan kuinka pitkällä kukin kilpailija on.
