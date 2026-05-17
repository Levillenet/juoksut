## Muutokset

Kaksi pientä UI-muutosta kuuluttajanäkymään. Ei vaikutuksia reititykseen, dataan tai logiikkaan — pelkkiä tekstejä ja yhden labelin lisäys.

### 1) Nimeä "Suunnittelu-näkymä" → "Tulosnäkymä"

Käytetään uutta sanaa ja päivitetään selite vastaamaan käyttötarkoitusta (päivän tulevat lajit + lopputulokset). Reitti `/announcer/planning` säilyy ennallaan (ei rikota tallennettuja kirjanmerkkejä eikä `localStorage`-arvoa `"planning"`).

**`src/routes/announcer.index.tsx`** (moodivalintakortti):
- `title`: "Suunnittelu-näkymä" → **"Tulosnäkymä"**
- `badge`: "SUUNNITTELU" → **"TULOKSET"**
- `description`: → **"Koko päivän tulevat lajit sekä jo päättyneiden lajien lopputulokset."**
- Alalaidan vinkki: "…toinen Suunnittelu-moodissa." → **"…toinen Tulosnäkymässä."**

**`src/components/announcer/AnnouncerHeader.tsx`**:
- `MODE_META.planning.label`: "SUUNNITTELU" → **"TULOKSET"**

**`src/routes/announcer.tsx`** (head-meta):
- Kuvauksessa "…yhdistetty, live- ja suunnittelumoodi…" → **"…yhdistetty-, live- ja tulosmoodi…"**

Sisäinen `Mode`-tyyppi ja reittiavain `"planning"` jätetään muuttamatta — vain käyttäjälle näkyvät tekstit vaihtuvat.

### 2) Näytä nykyinen moodi "Vaihda moodia" -painikkeen alla

Tällä hetkellä otsikon vieressä on pieni värillinen badge (LIVE/YHDISTETTY/TULOKSET), mutta se on helppo ohittaa. Lisätään sama tieto myös "Vaihda moodia" -painikkeen alapuolelle, jotta käyttäjä näkee yhdellä silmäyksellä missä moodissa on.

**`src/components/announcer/AnnouncerHeader.tsx`**:
- Käärytään `Vaihda moodia` -painike (desktop-variantti) pieneen `flex flex-col items-center` -kontaineriin.
- Painikkeen alle pieni teksti, esim.:
  ```
  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
    Nyt: {meta.label}
  </span>
  ```
- Mobiilivariantti (pelkkä ikoni, `sm:hidden`) jätetään ennalleen — siellä tila on ahdas ja moodibadge näkyy jo otsikon vieressä.

## Toteutusjärjestys

1. Päivitä `AnnouncerHeader.tsx` (label + "Nyt:"-rivi).
2. Päivitä `announcer.index.tsx` (kortin teksti, badge, kuvaus, vinkki).
3. Päivitä `announcer.tsx` head-kuvaus.
