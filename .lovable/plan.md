## Tavoite

Videot ja muistiinpanot ovat nyt lisättävissä lähinnä analytiikkanäkymän kilpailulistalta. Laajennetaan lisäysmahdollisuus urheilijan lajilistausnäkymiin, joissa niitä tällä hetkellä ei voi lisätä. Näkyvyys säilyy nykyisenä (omat + jaetut).

## Muutokset

### 1. Analytiikan tulossheet (`AthleteAnalytics.tsx` → `ResultDetailSheet`)
Nyt: `ResultVideoButton` on, mutta muistiinpanot ovat vain lukutilassa (`NoteBlock`).
Muutos: Korvataan/lisätään `NoteEditor`-komponentit kolmelle tasolle:
- Tulosmuistiinpano (competitionId + eventName + subCategory)
- Lajitason muistiinpano (eventScope)
- Kilpailun muistiinpano (competitionScope)

Muiden käyttäjien jaetut muistiinpanot näytetään `NoteEditor`:n `otherNotes`-propin kautta (sama malli kuin `athlete.$key.tsx`).

### 2. Lajikohtainen kehitys -taulukko (`RecordsPanel.tsx` → `EventGroupView`)
Nyt: taulukko listaa tulokset, mutta rivikohtaisesti ei ole video- eikä muistiinpanotoimintoja.
Muutos: lisätään jokaiseen tulosriviin pieni toimintopalkki oikeaan reunaan:
- `ResultVideoButton` (competitionId + eventName + subCategory)
- Pieni "muistiinpano"-ikonipainike, joka avaa Sheet-paneelin `NoteEditor`:llä samalla scopella

Jotta `EventGroupView` pysyy uudelleenkäytettävänä (käytössä myös muissa paikoissa kuin urheilijasivulla), lisätään uusi valinnainen prop `rowActions?: (row) => ReactNode`. `athlete.$key.tsx` täyttää sen video/muistiinpano-painikkeilla; muut kutsupaikat jättävät pois eikä UI muutu.

### 3. Data
`athlete.$key.tsx` hakee jo `notesQuery` ja `videosQuery` — käytetään samoja. Ei uusia serverfunktioita eikä migraatioita. Tallennus kulkee olemassa olevan `NoteEditor`:n ja `ResultVideoButton`:n kautta, jotka jo hoitavat invalidoinnin.

### 4. Näkyvyys ja RLS
Ei muutoksia tauluihin tai policyihin. Toimivat nykyisillä `athlete_notes`- ja `result_videos`-oikeuksilla (omat + tiimi/note_links -kautta jaetut).

## Tiedostot
- `src/components/AthleteAnalytics.tsx` — sheetin `NoteBlock`:ien tilalle `NoteEditor` (omat) + luku-lista muiden muistiinpanoista.
- `src/components/RecordsPanel.tsx` — `EventGroupView` saa `rowActions`-propin ja renderöi sen tulossarakkeeseen.
- `src/routes/athlete.$key.tsx` — antaa `rowActions`-funktion `EventGroupView`:lle; sisältää `ResultVideoButton` + pieni muistiinpanopainike.

## Ei kuulu tähän
- Ei muutoksia klubi-tänään- eikä kilpailulistausnäkymiin (rajattiin pois vastauksissasi).
- Ei uusia tauluja, migraatioita eikä jakomallin muutoksia.
