## Tavoite

Nimihaun (`/search`) tuloslistalla jokaisen urheilijan nimen vieressä näkyy painike, jolla urheilijan saa suoraan seurantaan ilman että pitää avata urheilijasivu. Painike toimii togglena: jos urheilija on jo seurannassa, painikkeesta näkyy tila ja sillä voi poistaa.

## Muutos

Muokataan vain `src/components/AthleteSearch.tsx` (käytetään myös `/search`-reitillä). Ei muita tiedostoja.

1. Tuodaan `useWatchedAthletes` ja `WatchedAthlete` `@/lib/watch-store`:sta sekä `Button` ja sopiva ikoni (`UserPlus` + `Check` lucide-reactista, sama tyyli kuin `watch.tsx`).
2. Kutsutaan `const { list: watched, add, remove } = useWatchedAthletes()` komponentissa.
3. Lasketaan `Set<string>` seurattavien `key`-arvoista nopeaa lookupia varten.
4. Jokaisen `GroupedAthlete`-kortin otsikkorivillä (nimen ja `n lajia` -badgen välissä) näytetään painike:
   - Jos `!watched`: ikoni `UserPlus`, teksti "Seuraa", `variant="outline"`, `size="sm"`. Klikkaus kutsuu `add({ key, surname, firstname, organization, organizationId })`.
   - Jos `watched`: ikoni `Check`, teksti "Seurannassa", `variant="secondary"`, klikkaus `remove(key)`.
   - Mobiilissa (pieni leveys) näytetään pelkkä ikoni-versio (`sm:hidden` teksti), jotta otsikkorivi ei mene rikki kapealla näytöllä.
5. Painikkeelle `aria-label`, `aria-pressed`, ja `onClick` käyttää `e.preventDefault(); e.stopPropagation()` ettei laukaise mahdollista ympäröivää linkkiklikkausta (otsikon `Link` on erillinen elementti, mutta varmistetaan ettei tapahtumat sotkeudu).
6. Pieni toast (`sonner`) tai pelkkä visuaalinen tilanvaihdos — käytetään pelkkää tilanvaihdosta yhdenmukaisesti `watch.tsx`-näkymän kanssa, ei toastia.

## Reuna­ehdot

- Toimii myös kirjautumattomalle käyttäjälle: `useWatchedAthletes` hoitaa fallbackin localStorageen, eli komponentti ei tarvitse omaa auth-tarkistusta.
- Mitään muuta hakulogiikkaa, indeksointia tai data-fetchausta ei muuteta.
- `AthleteSearch`-komponentin muut käyttöpaikat (jos niitä on) saavat saman painikkeen automaattisesti — tämä on toivottua, koska hakulogiikka on jo yhtenäistetty.
