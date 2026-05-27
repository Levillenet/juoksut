## Tavoite

Selkeyttää käyttöliittymä kokonaisuutena pyöreämmällä fontilla ja paremmalla typografiahierarkialla. Pääsivu kevyemmäksi, print-sivu järjestelmällisemmäksi, mobiili (320–414 px) varmasti toimivaksi. **Ei toiminnallisuusmuutoksia.** Kuuluttaja-, scoreboard-, ja /round/-näkymiä ei kosketa.

## 1. Typografia — pyöreä fontti

### `src/routes/__root.tsx`
Lisää Google Fonts -linkit (`preconnect` + Nunito 400/600/700/800) `head.links`-listaan.

### `src/styles.css`
- Lisää `@layer base` `html { font-family: 'Nunito', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }` ja `body { font-feature-settings: 'tnum' 1, 'cv11' 1; }`.
- Lisää uusi semanttinen token `--accent-warm` (oklch 0.96 0.05 85) + `--accent-warm-foreground` + `--accent-warm-border` light/dark, ja `@theme inline`:iin `--color-accent-warm`/`--color-accent-warm-foreground`/`--color-accent-warm-border`. Korvaa hardkoodatut `bg-amber-50/border-amber-500/...` käytöt näillä (kohdat: `src/routes/index.tsx` admin- ja hauskat-tilastot -kortit, `src/components/NoteLinkInvitesBanner.tsx`).

### Pyöreän fontin huomioon ottaminen
Nunito tekee raskaista tyyleistä liian massiivisia. Kevennä globaalisti:
- `font-black tracking-widest uppercase` → `font-bold tracking-wide uppercase` (otsikot)
- `font-extrabold` → `font-bold` ryhmäotsikoissa

## 2. Pääsivu — selkeämpi (`src/routes/index.tsx`)

- Header: `py-3` → `py-4`, pienennetään meta-info raskautta ja muutetaan "päivitetty …" -teksti hennommaksi.
- "Aktiivinen kilpailu" -lohko: säilyy, mutta otsikkofontti `font-semibold tracking-wide` (ei tracking-wider) ja lohkon `p-4` → `p-5`.
- "Avaa valikko" -nappi: poista `tracking-widest` ja `font-bold uppercase` korostus, tyyli `rounded-xl border-2 border-primary/30 bg-card text-base font-semibold text-foreground hover:bg-secondary` + ikoni `ChevronDown`/`ChevronUp`.
- Navikortit (`NavCards`):
  - `gap-2` → `gap-3`, `border-primary/30` → `border-border` (hennommat reunat)
  - Sisäinen `py-2.5` → `py-3`, otsikko `text-sm font-semibold` säilyy mutta `leading-snug`
  - Admin- ja hauskat-tilastot -kortit käyttävät uutta `bg-accent-warm border-accent-warm-border`
- "Päivän lajit" -otsikko: `text-lg font-black uppercase tracking-widest text-primary` → `text-lg font-bold tracking-tight text-foreground` + pieni alalinja accentille.
- Päivänappi-rivi: `text-sm font-medium` säilyy; aktiivinen `bg-primary` ok.

## 3. Pääsivun sektiot

### `src/components/TodayStatsSection.tsx`
- `grid-cols-5` → `grid-cols-3 sm:grid-cols-5` (5 kolumnia liian ahdas 320 px:llä).
- `StatTile`: label `text-[10px]` → `text-[10px] font-medium tracking-wide`, otsikko `text-2xl font-black` → `text-2xl font-extrabold`.
- Tile-padding `px-2 py-3` → `px-2 py-3.5`, `rounded-xl` säilyy.

### `src/components/DailyBestSection.tsx`
- Lisää listan väleihin `space-y-2.5` jos nykyinen on tiheä; varmista että pyöreä fontti ei tuki.
- Otsikko `text-sm font-semibold` säilyy.

### `src/components/ClubTodaySection.tsx`
- Sisäinen `<select>` `rounded-md` → `rounded-lg`, `h-9` → `h-10` mobiilipeukaloystävällisyyden vuoksi.

### `src/components/LiveCompetitionsSection.tsx`
- "Seurataan"-badge: kevennä `font-black` → `font-semibold`.

### `src/components/SeasonStatsSection.tsx`
- Jos taulukko leviää mobiilissa: `-mx-4 px-4 overflow-x-auto` wrapper.

### `src/components/CompetitionSwitcher.tsx`
- Tämän päivän `SelectLabel`: `font-extrabold` → `font-bold`.
- Ryhmien väliin pieni `mt-1` separaattori.

### `src/components/HarvestStatusBadge.tsx`
- Hienovaraisempi muotoilu: `opacity-70 text-[11px]`.

### `src/components/NoteLinkInvitesBanner.tsx`
- Korvaa amber-värit `bg-accent-warm border-accent-warm-border text-accent-warm-foreground`.

## 4. Print-sivut

### `src/routes/print.tsx`
- Tabit:
  - "Kisojen lajiaikataulu" → **"Kilpailun aikataulu"**
  - "Omat seurannassa" → **"Omat urheilijat"**
- Tab-painikkeet hieman isommiksi mobiilissa: `px-3 py-1.5 text-xs` → `px-4 py-2 text-sm`, `rounded-full` säilyy.

### `src/routes/print.index.tsx`
- Meta `title: "Tulostettava aikataulu"` → **"Kilpailun aikataulu"** (myös description päivitys).
- H1 sticky-headerissä `"Tulostettava aikataulu"` → **"Kilpailun aikataulu"**.
- **Siirrä suodatusvalinnat ja vinkki pois ahtaasta sticky-headerista** omaan card-paneeliin pää-sisällön yläosaan (`main`-blokin sisällä, ensimmäinen lapsi):
  - Card: `rounded-xl border bg-card p-4 shadow-sm print:hidden`
  - Otsikko sisällä: `Lajisuodatus` (text-xs uppercase tracking-wide muted)
  - Painikkeet `(running/all)` isompina: `px-4 py-2 text-sm font-semibold rounded-lg`, koko leveydeltä `flex w-full gap-2` mobiilissa (`sm:w-auto`).
  - Vinkkiteksti omalle riville `text-[11px] text-muted-foreground` lihavoinnilla "Tallenna PDF-tiedostona"-osassa.
- Headeriin jää: takaisin-nappi, otsikko, "Tulosta / Tallenna PDF" -nappi.

### `src/routes/print.club.tsx`
- Seuranvalinta `<select>` `h-9` → `h-12` mobiilissa, `text-sm` → `text-base`.
- Tulostusvalinnat samanlaiseen card-paneeliin (yhtenäisyys).

### `src/routes/print.watched.tsx`
- Sama card-paneeli mahdollisille filttereille (jos sellaisia on); muuten vain leipätekstin paranneltu mobiilin marginaali.

### `src/routes/index.tsx` (navikortti)
- "Tulostettava aikataulu" -kortin otsikko → **"Kilpailun aikataulu"**, alateksti säilyy.

## 5. Muut näkymät — pikakorjaukset

### `src/routes/watch.tsx`
- Otsikko: poista `tracking-widest font-black`; käytä `text-lg font-bold`.
- Urheilijakortit grid: varmista `grid grid-cols-1 sm:grid-cols-2 gap-3` (ei pelkkä `sm:grid-cols-2`).

### `src/routes/athlete.$key.tsx`
- Yläpalkki: poista `uppercase` otsikoista, säilytä `font-semibold`.
- `StatCard` klikkausalue: kasvata `py-2` → `py-3`, `rounded-lg` säilyy.

### `src/routes/hauskat-tilastot.tsx`
- `TabsList` `w-full` ja `TabsTrigger` `flex-1 text-xs sm:text-sm` ettei skrollaa mobiilissa.

### `src/routes/season-leaders.tsx`
- `LeaderItem`: nimisarakkeeseen `min-w-0 truncate`, sijoitusnumero ja ikoni `shrink-0`.

### `src/routes/search.tsx`
- Otsikko näkyviin myös mobiilissa: poista `lg:block` tai vaihda `sm:block`.

### `src/routes/kilpailukalenteri.tsx`
- Aikaväli-napit: `flex flex-wrap gap-2` (ei vaakaskrollaa).

### `src/routes/settings.tsx`
- `REFRESH_OPTIONS` napit: `px-3 py-1.5` → `px-4 py-2`, `gap-2` → `gap-2.5`.

### `src/routes/login.tsx`
- Konttikorttiin `w-full max-w-sm mx-auto px-4 sm:px-6` (poistetaan `px-8` mobiilissa).

### `src/components/WelcomeDialog.tsx`
- `DialogContent` `w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto`.

### `src/routes/seuraa.$token.tsx`
- Sama otsikkokeveennys kuin watch.tsx (poista uppercase + black-paksuus jos käytössä).

### `src/routes/tietoa-palvelusta.tsx`
- Leipätekstin `leading-relaxed` jos puuttuu; otsikoiden paksuus `font-semibold` (ei black).

## 6. Mitä EI muuteta

- `src/routes/announcer.*` (kuuluttaja)
- `src/routes/scoreboard.tsx` (suorituspaikan livenäyttö)
- `src/routes/round.$eventId.$roundId.tsx` (livekierros)
- `src/routes/admin.*`, `src/routes/api/*`
- Kaikki tiedostot `src/lib/`, `src/integrations/`, supabase/, routeTree.gen.ts
- Mitkään `fetch*`-, `useQuery`- tai datakäsittelylogiikat — vain class-, järjestys- ja tekstimuutoksia.

## 7. Varmistus mobiilissa

Plan mode -> build mode siirtymän jälkeen otetaan `browser--set_viewport_size 390x844` + screenshot pääsivulta ja print/-sivulta tarkistukseksi, että rivit eivät katkeile.