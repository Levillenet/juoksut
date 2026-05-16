## Tavoite

Seurattavien tikkeripalkki näkyy `/watch`-sivulla **vain kun jollakin seurattavalla on käynnissä oleva kenttälajikilpailu** (`round.Category === "Field"` ja `round.Status === "Progress"`). Muulloin palkki on piilossa. Jos historiaviestejä on, näytetään pieni "Näytä ticker (N)" -nappi oikeassa alakulmassa, josta historian saa auki.

## Muutokset

### 1. Aktiivisuuden laskenta `src/routes/watch.tsx`

Lisätään johdettu `hasActiveWatchedField`:
```ts
const watchedKeys = useMemo(
  () => new Set(watched.map(w => `${w.surname}|${w.firstname}|${w.organizationId ?? ""}`)),
  [watched],
);
const hasActiveWatchedField = useMemo(() => {
  if (!index) return false;
  return index.entries.some(e =>
    e.round.Category === "Field" &&
    e.round.Status === "Progress" &&
    watchedKeys.has(`${e.alloc.Surname}|${e.alloc.Firstname}|${e.alloc.Organization?.Id ?? ""}`),
  );
}, [index, watchedKeys]);
```
Välitetään tämä uutena propsina tikkeripalkkiin.

### 2. `src/components/announcer/LiveTicker.tsx` — uusi `active`-prop

- Lisätään `active?: boolean` (oletus `true`, jotta announcer-näkymät pysyvät ennallaan).
- Logiikka:
  - Jos `enabled` ja `active` → näytä tikkeripalkki normaalisti.
  - Jos `enabled` mutta `!active` → palkki piilossa; jos `messages.length > 0` näytä oikean alakulman pieni "Näytä historia (N)" -nappi joka avaa pelkän historiapaneelin (ei muuta `enabled`-tilaa). Jos viestejä ei ole, älä renderöi mitään.
  - Jos `!enabled` → nykyinen "Näytä ticker" -nappi (käyttäjän itsensä piilottama).
- Pieni refaktorointi: historiapaneeli (`expanded`) voi näkyä myös `active === false` -tilassa kun käyttäjä klikkaa "Näytä historia" -nappia; sulkemalla menee taas piiloon.

### 3. `src/routes/watch.tsx` — propin välitys

`<LiveTicker source="watched" active={hasActiveWatchedField} />`

Announcer-näkymät (`combined`, `live`, `planning`) jätetään ennalleen — niissä `active` jää oletukseen `true`, joten käytös ei muutu.

### 4. `pb-12` watch-näkymässä

Sivun alaosan padding `pb-12` voidaan jättää paikoilleen, koska se varmistaa että historianappi ei peitä sisältöä silloinkin kun palkkia ei näytetä. (Halutessa voidaan tehdä ehdolliseksi, mutta tarpeetonta layoutin riskeerausta.)

## Mitä ei muuteta

- `useWatchedFieldChanges` jatkaa viestien työntämistä storeen aina kun parannuksia tulee — historia kerääntyy taustalla, vaikka palkki olisi piilossa.
- Viestien `localStorage`-persistointi pysyy ennallaan.
- Announcer-tikkerin (lähde `"announcer"`) käytös ei muutu.

## Tekniset huomiot

- `Round.Status` lukee `index.entries[i].round.Status` -kentästä. Tieto tulee `fetchRounds`-kutsusta ja päivittyy 60 s välein (sama kuin nyt indeksissä).
- Aktiivisuus arvioidaan reaktiivisesti — kun viimeinen seurattavan käynnissä oleva laji menee `Official`-tilaan, palkki katoaa automaattisesti seuraavalla refreshillä ja vaihtuu "Näytä historia (N)" -napiksi mikäli viestejä on jäänyt.
