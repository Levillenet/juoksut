## Tavoite

Urheilijasivulle (`/athlete/$key`) lisätään kaksi uutta muistiinpanotasoa nykyisen tulosrivin muistiinpanon lisäksi:

- **Lajitason muistiinpano** — koskee lajia kaikkien kilpailujen yli (esim. "60 m aidat": askelmerkit, tekniikka, kausitavoite). Näkyy "Lajikohtainen kehitys" -osiossa jokaisen lajin alla.
- **Kilpailutason muistiinpano** — koskee koko kilpailua (esim. olosuhteet, matkakommentit, sää). Näkyy "Kilpailut" -osiossa jokaisen kilpailukortin otsikon alla.
- **Tulosrivin muistiinpano** (kilpailu × laji) — säilyy sellaisenaan.

## Toteutus

### 1. Data-malli (ei migraatiota)

`athlete_notes`-taulun uniikkiavain `(user_id, athlete_key, competition_id, event_name, sub_category)` tukee jo useaa scoped-riviä sentineliarvoilla:

- **Tulosrivi**: `competition_id`, `event_name`, `sub_category` — nykyinen tila, ei muutosta.
- **Lajitaso**: `competition_id = 0`, `event_name = <lajin nimi>`, `sub_category = <sub>`.
- **Kilpailutaso**: `competition_id = <kisan id>`, `event_name = ""`, `sub_category = ""`.

Kaikki kentät ovat NOT NULL ja hyväksyvät `0`/`""`, joten migraatiota ei tarvita.

### 2. `src/lib/athlete-notes.ts`

- Vakiot `EVENT_SCOPE_COMPETITION_ID = 0` ja `COMPETITION_SCOPE_EVENT_NAME = ""`.
- Yleistetään `upsertNote` (jo tukee kaikkia kenttiä — käyttökohde vain valitsee sentinelit).
- Lisätään pieni apuri `noteScope(note)` → `"result" | "event" | "competition"` `notesByEvent`-koosteen hyväksi (jotta yhteinen lista näyttää oikean sijainnin).
- `placeholderForEvent` saa toisen version kilpailutasolle (esim. "Sää, kuljetus, ruokailu, tunnelma…").

### 3. `src/routes/athlete.$key.tsx`

- **Kilpailukortin otsikko** (rivi ~608): otsikon oheen `NoteButton` (sama UI-komponentti kuin tulosrivissä) → tallentaa scope=competition. Näytä myös tiimiläisten kilpailumuistiinpanot samaan tapaan kuin nyt.
- **Lajikohtainen kehitys** (`EventGroupView`, rivi ~596): jokaisen lajin viimeisen tulosrivin alle `NoteButton` scope=event.
- Refaktoroidaan nykyinen `CompetitionResultRow`in muistiinpanolohko omaksi komponentiksi `NoteEditor` (nappi + textarea + tallennus + otherNotes-lista), jota kolme sijaintia käyttävät. Placeholder tulee scopen mukaan.
- `notesQuery.data`-haku pysyy samana (kaikki muistiinpanot per athleteKey); sisäinen `noteKey`-mapin lookup toimii kaikilla kolmella sentinelillä.
- "Näytä kaikki muistiinpanot" -yhteenveto: koostetta laajennetaan näyttämään scope-otsikko ("Laji", "Kilpailu", tulos-rivi näyttää kilpailun+lajin nykyiseen tapaan) ja tunnistetaan sentinelit.

### 4. Verifiointi

Playwright: kirjaudu sisään, avaa `/athlete/<key>`.
- Lajikohtainen kehitys -osiossa näkyy "Lisää muistiinpano" -nappi jokaiselle lajille; tallentuu ja säilyy reloadin jälkeen.
- Kilpailut-osiossa jokaisen kilpailun otsikon alla samoin nappi kilpailulaajuiselle muistiinpanolle.
- Tulosrivien muistiinpanot toimivat kuten ennen.
- "Näytä kaikki muistiinpanot" -yhteenveto listaa kaikki kolme tyyppiä eroteltuina.
