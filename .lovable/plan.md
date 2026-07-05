## Tavoite
Päivän videot -sivun erätuloslistassa nimet katkeavat mobiilissa useammalle riville. Levennetään nimikenttä ja tehdään visualisointi tyylikkäämmäksi niin että nimi mahtuu yhdelle riville.

## Muutokset (vain `src/routes/videot.tsx` – `HeatResultsList`)

### 1. Nimikentälle enemmän tilaa
- Kavennetaan **Sija**- ja **Rata**-sarakkeet mobiilissa (`1.75rem` sija-numerolle, `2rem` radalle) ja tehdään niistä kompaktimmat myös `sm:` breakpointissa.
- Kavennetaan **Tulos**-sarake mobiilissa (`3.25rem`) – tulokset kuten "8.45" tai "12,34" mahtuvat hyvin.
- Näin nimelle jää mobiilissakin selvästi leveämpi `minmax(0,1fr)`.

### 2. Nimi & seura samalle riville, tyylikkäämmin
- Nimirivi: `flex flex-col` – rivi 1 = nimi (`truncate`, font-semibold), rivi 2 = seura pienemmällä ja hillityllä värillä (`truncate`, text-[10px] muted).
- Poistetaan `break-words` – korvataan `truncate` + `min-w-0` niin ettei sana pilkkoudu keskeltä.
- Tuloksena kompakti kaksirivinen "chip": nimi ylhäällä, seura alla – näyttää siistiltä eikä katkea sanan keskeltä.

### 3. Sija & rata visuaalisesti erottuvammiksi
- Sija: pieni pyöristetty `bg-muted` -pallero numerolle (esim. `1.` → `1`), text-align keskitettynä.
- Rata: `R3` monospace-fontilla + accent-värillä (`text-primary`), jotta silmä löytää radan nopeasti videota katsoessa.

### 4. Rivien tiheys
- `py-2` mobiilissa (nykyisen `py-1.5` sijaan) koska rivit ovat nyt kaksirivisiä (nimi + seura).
- Header-rivissä yksi sarake per otsikko, kevyt `text-[10px] tracking-wider`.

## Rajaus
Vain `HeatResultsList`-komponentin JSX-muutos videoiden avausdialogissa ja korttien "Näytä erän tulokset" -listassa. Ei muutoksia dataan, kyselyihin eikä muuhun sivun rakenteeseen.
