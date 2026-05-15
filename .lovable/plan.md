## Tavoite

Lisätään kisaseuraajien puolelle uusi sivu **/season-leaders** ("Kauden kärki"), jolla voi katsoa kaikkien kantaan tallennettujen urheilijoiden kauden parhaita tuloksia ikäluokittain ja lajeittain. Omassa seurannassa olevien urheilijoiden tulokset korostetaan listalla, ja jos he eivät mahdu top-N:ään, heidän paras tuloksensa näytetään erikseen.

## Kausijako

Lisätään `season-stats.ts`:n `seasonRange()`-funktioon kaksi uutta arvoa:
- `outdoor` → 1.5.–30.9. (vuosi valitaan referenssipäivämäärän mukaan)
- `indoor` → 1.10.(prevYear) – 30.4.(thisYear)

Vanhat `summer`/`winter` säilytetään taaksepäin yhteensopivuuden vuoksi (käytössä `SeasonStatsSection.tsx`:ssä), mutta uusilla aliaksilla `outdoor`/`indoor` on käyttäjälle näkyvät otsikot **"Ulkokausi"** ja **"Hallikausi"**. Käytännössä toteutus jakaa logiikan jaetuksi util-funktioksi.

## Datan haku

Uusi tiedosto `src/lib/season-leaders.ts`:

- `fetchSeasonLeaders({ season, ageClass, eventName, limit })` lukee `athlete_results`-taulusta:
  - rajaa `competition_date` valittuun kauteen
  - rajaa `age_class` (jos valittu)
  - rajaa lajilla käyttäen olemassa olevaa `normalize_event_name`-RPC:tä tai client-side normalisointia (sama logiikka kuin `season-stats.ts`:n `norm()`)
  - vaatii `result_numeric IS NOT NULL`
  - hallikaudella suodatetaan vain hallilajeihin sopivat tulokset (oletuksena käytetään kaikkia kauden aikana tehtyjä tuloksia, koska kausijako jo rajaa)
- Palauttaa rivit järjestettynä:
  - `event_category = 'Track'` → nouseva (pienin aika voittaa)
  - muut → laskeva (suurin pituus/heitto voittaa)
- Jokaiselle urheilijalle pidetään vain **paras tulos** ko. lajissa (deduplikointi `athlete_key`)
- Top-N (oletus 50) palautetaan
- Erillinen `fetchWatchedBests` palauttaa kirjautuneen käyttäjän seurattujen urheilijoiden parhaat tulokset samassa lajissa/kaudessa/ikäluokassa, jotta voidaan näyttää myös ne, jotka eivät ole top-N:ssä

Lajilistan ja ikäluokkalistan haku:
- Erillinen kevyt query `athlete_results` → distinct `event_name` + `age_class` valitulla kaudella. Lajit ryhmitellään normalisoidulla nimellä (esim. "60 m" ja "60 m aj." pysyvät erillisinä, mutta "M14 60 m" ja "60 m" yhdistyvät).

## UI: `src/routes/season-leaders.tsx`

Sivu kirjautuneille käyttäjille (rooli `user` tai `official`):

```text
┌─ Kauden kärki ────────────────────────┐
│ [Ulkokausi 2026] [Hallikausi 25–26]   │  ← kausivalitsin (Tabs)
│                                        │
│ Ikäluokka: [Yleinen ▾]  Laji: [100m ▾]│  ← Select + Combobox
│                                        │
│ Omat seurattavat tässä lajissa:        │
│ • #12 Matti Meikäläinen 11.85 (LA)    │  ← korostettu, jos top-N:ssä → linkki
│ • Liisa Esimerkki   12.40 (LA)         │  ← jos ei top-N:ssä, näkyy silti
│                                        │
│ Top 50:                                │
│ 1.  10.85 Pekka P.  (Helsinki)        │
│ 2.  10.92 Antti A.  (Turku)           │
│ ...                                    │
│ 12. 11.85 Matti M.  (LA) ⭐            │  ← seurattu = highlight + tähti
└────────────────────────────────────────┘
```

Komponentit:
- Käytetään olemassa olevaa `Tabs`/`Select`/`Combobox`-shadcn-komponentteja
- Tulos formatoidaan: track → mm:ss,xx tai s,xx; muut → m yksiköllä
- Nimirivi linkki `/athlete/$key`-sivulle (olemassa)
- Tila kysytään `useQuery`-hookilla, key sisältää `[season, ageClass, eventName]` → automaattinen cache
- Sivulla refresh-painike, ei automaattista kyselyä (data vaihtuu hitaasti)

## Etusivun linkki

Lisätään `src/routes/index.tsx`-tiedoston nav-grid-osioon uusi kortti **"Kauden kärki"** kaikille rooleille (näkyy myös `official`-roolille). Kortti renderöityy `Hae sukunimellä` ja `Kilpailijaseuranta` -korttien rinnalle.

## Tekninen yhteenveto

| Tiedosto | Muutos |
|---|---|
| `src/lib/season-stats.ts` | Lisää `outdoor`/`indoor` arvot `SeasonKind`iin, päivitä `seasonRange()` |
| `src/lib/season-leaders.ts` | UUSI: top-tulosten haku + watched-tulosten haku |
| `src/routes/season-leaders.tsx` | UUSI: sivu, käyttää useQuery + RequireRole |
| `src/routes/index.tsx` | UUSI nav-kortti `/season-leaders` |
| `src/components/SeasonStatsSection.tsx` | Säilytä taaksepäin yhteensopivuus (käyttää edelleen `summer`/`winter`) |

Ei muutoksia kantaan eikä RLS-policiesseihin – `athlete_results` on jo luettavissa kaikille kirjautuneille.

## Hyväksymiskriteerit

- /season-leaders näkyy kirjautuneille käyttäjille, etusivun nav-kortti vie sinne
- Kausivalinta (Ulko/Halli) toimii ja vaikuttaa lajilistaan ja tuloksiin
- Ikäluokka- ja lajisuodatin toimivat
- Top-lista näyttää oikeassa järjestyksessä (track nouseva, muut laskeva)
- Yksi rivi per urheilija (paras tulos)
- Omassa seurannassa olevat urheilijat näkyvät korostettuina ja erillisessä "omat seurattavat" -osiossa, vaikka eivät olisi top-N:ssä
- Linkki urheilijasivulle toimii
- TS- ja ESLint-tarkistukset menevät läpi
