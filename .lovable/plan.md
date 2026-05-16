## Tilanne

Nyt `hauskat-tilastot` -sivu hakee dataa vain `watched_athletes`-taulun urheilijoille (eli käyttäjän omat seuratut). Sinä haluat:

1. Sivu näyttää tilastoja **koko tietokannan** urheilijoista, ei vain seuratuista.
2. **Seuravalinta** (pakollinen rajaus, jotta data ei räjähdä) — käyttäjä valitsee yhden seuran (esim. "Lahden Ahkera").
3. **Ikäluokkavalinta monivalintana** — käyttäjä voi rastittaa esim. P9, P10, P11, T9, T10, T11 → näytetään kaikki alle 12-vuotiaat. Oletuksena kaikki valittu.

## Muutokset

### 1. `src/lib/fun-stats.ts`
- Poistetaan `watched_athletes`-rajaus.
- Funktion signatuuri: `fetchFunStats(season, orgFilter: string | null, ageClassFilter: string[] | null)`.
  - `orgFilter`: jos `null` → ei haeta mitään (palautetaan tyhjä; seuravalinta pakollinen).
  - `ageClassFilter`: jos `null` tai tyhjä taulukko → ei rajata; muutoin `in()`.
- Kysely: `from("athlete_results")` + `.eq("organization", orgFilter)` + `.in("age_class", ageClassFilter)` + season-rangerajaus.
- Lisätään `fetchOrganizations(season)` joka palauttaa uniikit `organization`-arvot kauden datasta (lajittelu: ensin Lahden Ahkera ja muut tunnetut, sitten aakkosjärjestys; suodatetaan pois "0", "-", ".", tyhjät).
- Lisätään `fetchAgeClasses(season, org)` joka palauttaa uniikit `age_class`-arvot valitulle seuralle.
- `Acc`-rakenne ja metriikat säilyvät ennallaan.
- Vaihe 1 limit 1000 voi tulla vastaan isoilla seuroilla → käytetään sivutusta (range) jos rivimäärä > 1000.

### 2. `src/routes/hauskat-tilastot.tsx`
- Lisätään tila: `org: string` (oletus käyttäjän oman seuran arvaus tai tyhjä), `ageClasses: string[]` (oletus kaikki).
- Yläpalkkiin:
  - **Seuravalinta** (`Select`, haettavalla `Command`-popoverilla koska seuroja paljon). Pakollinen — jos tyhjä, näytetään ohjeteksti "Valitse seura".
  - **Ikäluokat**: korvataan nykyinen `Select` `Popover`+`Checkbox`-listalla (monivalinta). Painikkeessa lyhyt yhteenveto ("3 ikäluokkaa" / "Kaikki ikäluokat" / "P9, P10").
- Kausivalinta ja päivityspainike säilyvät.
- Query: `["fun-stats", season, org, ageClasses.join(",")]`, `enabled: !!org`.
- Erillinen kysely seuralistalle ja ikäluokkalistalle (riippuu seurasta).
- Oletus-seura tallennetaan `localStorage`iin (`funstats:org`), niin että käyttäjän valinta muistetaan.

### 3. Korjaus runtime-erroriin
Nykyisessä `fun-stats.ts`:ssä on syntaksivirhe rivillä 248 (`Unexpected "{"`). Tarkistetaan ja korjataan saman ohessa (todennäköisesti vanhasta editistä jäänyt rivi).

## Tekninen huomio

- Suuren datan kysely (esim. "Hippo" ~2000 urheilijaa × monta suoritusta) voi olla raskas. Pidetään season-rajaus ja sivutus, ja näytetään latausindikaattori.
- Ei DB-muutoksia.
- Ei muutoksia muihin sivuihin.

## Lopputulos

Käyttäjä avaa Hauskat tilastot → valitsee seuran (esim. "Lahden Ahkera") → rastittaa halutut ikäluokat (esim. P9–P11, T9–T11) → näkee kaikkien seuran ko. ikäluokkien lasten kärkilistat 21 leikkimielisellä mittarilla.
