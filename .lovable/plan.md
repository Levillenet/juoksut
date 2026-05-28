# Miksi näin tapahtuu

`Seuranta`-sivu (`/watch` ja `/seuraa/$token`) käyttää `competitionIndexQueryOptions`-kyselyä, joka:

1. Hakee kisan **kaikki lajit** yksitellen (kisassa ~109 lajia → 109 HTTP-kutsua).
2. Päivittää edistymislaskurin `onProgress(done, total)` jokaisen lajin jälkeen → siksi näet "0/109 → 109/109".
3. **Toistaa tämän koko operaation 20 sekunnin välein** (`refetchInterval: 20_000` rivillä 142), koska jokainen polling-kierros käynnistää koko `queryFn`:n alusta.

Eli mitään ei oikeasti "ladata uudelleen tyhjästä" — välimuistissa oleva data säilyy ruudulla — mutta laskuri-UI näkyy aina kun taustapäivitys käy.

# Korjaus (vain `src/routes/watch.tsx` + `src/lib/tuloslista-queries.ts`)

**1. Pidennä polling-intervalli 20s → 60s** (`tuloslista-queries.ts` rivi 142).
Watch-näkymässä ei tarvita 20 sekunnin tarkkuutta; tulosrivit silti elävät kun avaat yksittäisen erän (`eventDetailsQueryOptions` polling 15s pysyy ennallaan).

**2. Näytä "Ladataan osallistujatietoja… X/Y" vain ensilatauksessa.**
Watch-sivulla (`src/routes/watch.tsx` rivit ~359-361) ehto on tällä hetkellä `loading && progress.total > 0`. Vaihdetaan siten, että laskuri näkyy vain kun dataa ei vielä ole välimuistissa:
```
{indexQuery.isLoading && progress.total > 0 && (...)}
```
(`isLoading` on `true` vain ennen ensimmäistä onnistunutta hakua; `isFetching` on `true` myös taustapäivityksissä — sitä emme halua näyttää.)

**3. Vaimennetaan myös taustakierroksen progress-päivitykset**, jotta laskuri ei "kilautakaan" hetkellisesti uudelleenrenderissä. Lisätään `onProgress`-kutsuun ehto: päivitä `setProgress` vain jos edellinen tila oli `{0,0}` tai data puuttuu. Yksinkertaisin tapa: nollaa `progress` `useEffect`illa kun `indexQuery.data` on olemassa.

Vaihtoehtoisesti: ohitetaan `onProgress` kokonaan kun `queryClient` palauttaa cachen — mutta yo. ratkaisu riittää.

# Mitä EI muuteta

- `eventDetailsQueryOptions` (avoinna olevan erän live-polling) pysyy 15 s.
- Datalogiikka, RLS, layout — ei muutoksia.
- Jaettu `/seuraa/$token`-sivu saa saman hyödyn automaattisesti (käyttää samaa kyselyä).

# Lopputulos

- Taustapäivitys käy 60 s välein, ei 20 s.
- Käyttäjä ei näe "Ladataan 0/109 → 109/109" -laskuria muulloin kuin kun sivu avataan ensimmäistä kertaa.
- Tulokset päivittyvät yhä taustalla; vain UI-häiriö poistuu.
