## Ongelma

Mobiilissa tulokset päivittyvät vasta kun käyttäjä tekee selaimen refreshin. Vaikka pollaus (5–15 s) on käytössä, mobiiliselaimet pysäyttävät tai kuristavat taustavälilehden JS-ajastimet. Kun käyttäjä palaa sovellukseen, näkymä jää vanhaksi koska kaikissa live-kyselyissä on `refetchOnWindowFocus: false`.

## Korjaus

Vaihdetaan live-datan React Query -asetukset päivittymään automaattisesti, kun sovellus palaa etualalle tai verkko palautuu.

### Muutokset `src/lib/tuloslista-queries.ts`

1. `eventDetailsQueryOptions` (rivit 291-295):
   - `refetchOnWindowFocus: "always"` (myös kun data on tuore, koska mobiilin taustapollaus ei ehtinyt ajaa)
   - `refetchOnReconnect: "always"`
2. `competitionScheduleQueryOptions` (rivit 235-239): sama muutos.
3. `competitionResultsQueryOptions` (rivit 215-219): sama muutos, jotta seurattavien kilpailun tulokset päivittyvät myös.

### Muutos `src/routes/watch.tsx` (rivi ~1239)

Lisätään `refetchOnWindowFocus: "always"` ja `refetchOnReconnect: "always"` päivän tulokset -kyselyyn.

### Muutos `src/routes/seuraa.$token.tsx` (rivi ~66)

Sama lisäys jaetulle seurantalinkille.

## Tekniset huomiot

- `"always"` (eikä pelkkä `true`) pakottaa refetchin myös kun `staleTime` ei ole täynnä. Tarvitaan koska mobiilin backgrounded-tabin pollaus ei tuo dataa uunista.
- `refetchIntervalInBackground: true` pysyy — se auttaa desktopissa ja PWA-tilassa, mutta ei riitä yksin mobiiliselaimessa.
- Ei uusia realtime-subscriptioita: data tulee ulkoisesta API:sta proxyn kautta, ei Supabase-taulusta, joten postgres_changes ei sovi. Focus-refetch on kevyempi ja hyödyntää olemassa olevaa reunavälimuistia (3 s TTL).