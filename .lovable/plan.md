## Muutokset

### 1. `src/routes/hauskat-tilastot.tsx` — muista kausi ja ikäluokat

- Lisää `localStorage`-avaimet:
  - `funstats:season` (arvot `year` | `summer` | `winter`)
  - `funstats:ages` (JSON-array valituista ikäluokista)
- Alusta `season`-tila lukemalla `localStorage.getItem("funstats:season")` (fallback `"year"`).
- Kirjoita `season` localStorageen `useEffect`illa kun se muuttuu (kuten `org` jo tehdään).
- Ikäluokat:
  - Alusta `selectedAges` localStoragesta jos arvo on tallennettu, ja aseta `ageTouched = true` silloin, jotta nykyinen "valitse kaikki kun data latautuu" -auto-init ei ylikirjoita.
  - Kirjoita `selectedAges` localStorageen kun se muuttuu (vain jos `ageTouched`).
  - **Tärkeää:** poista nykyinen `useEffect`, joka nollaa `selectedAges` ja `ageTouched` kun `org` tai `season` muuttuu. Sen sijaan: pidä käyttäjän valinta. Jos käyttäjä vaihtaa seuraa ja nykyiset valitut ikäluokat eivät kuulu uuden seuran `allAges`-listaan, suodata `selectedAges` automaattisesti vain niihin jotka ovat saatavilla (jos tyhjäksi jäisi, valitse kaikki uuden seuran ikäluokat).

### 2. `src/routes/athlete.$key.tsx` — takaisin-nuoli oikeaan paikkaan

Nykyinen `<Link to="/watch">` vie aina watch-sivulle. Vaihda se siten, että nuoli käyttää selainhistoriaa:

- Korvaa `Link` tavallisella `<button>`illa, joka kutsuu `router.history.back()`.
- Käytä `useRouter()`-hookia `@tanstack/react-router`:sta.
- Fallback: jos `router.history.length <= 1` (esim. avattu suoraan), navigoi `/watch`-sivulle kuten ennen.

Tämä korjaa kaikki tulopolut (hauskat tilastot, haku, watch jne.) — käyttäjä palaa aina sinne mistä tuli.

## Mitä ei muuteta

- Seuravalinta (`funstats:org`) toimii jo, jätetään ennalleen.
- `fetchFunStats` / data-logiikka pysyy ennallaan.
