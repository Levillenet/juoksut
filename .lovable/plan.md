## Ongelma

1. **Videolinkki ei näy** urheilijaseurannassa (`/watch`) lajin kohdalla.
   - `ResultVideoButton` piilottaa itsensä (`return null`) kun `!anyVisible && !canEdit`. Se toimii, kun käyttäjä on kirjautunut. Tarkennetaan käyttäytymistä ja tehdään nappi selvästi näkyväksi kirjautuneelle myös silloin, kun tulosta ei vielä ole.
   - Nykyinen nappi näkyy vain rivin oikeassa reunassa ohuena YouTube-ikonina + "Video"-tekstinä `text-muted-foreground`-värillä. Muutetaan tyyliksi selvä punainen "Video"-painike (kuten muuallakin), niin sen huomaa mobiilissa.

2. **Urheilijatilastot-nappi katkaisee nimen** kapealla mobiiliruudulla.
   - Rivi on nyt `flex items-baseline justify-between` — nimi + nappi samalla rivillä → nimi typistyy (esim. "Väli-Klemel...").
   - Siirretään nappi nimen alapuolelle mobiilissa (`sm:` ja ylös rinnalle isommilla näytöillä).

## Muutokset

### `src/routes/watch.tsx` (rivit 679–707)
Muutetaan otsikkolohko responsiiviseksi:
- Mobiilissa: nimi ja seura omalla rivillään koko leveydeltä, alla omalla rivillä `Urheilijatilastot`-nappi + poistorasti.
- `sm:` ja ylöspäin: alkuperäinen `flex justify-between` -asettelu palautuu.
- Pieni `X`-poistonappi jää aina nimirivin oikeaan reunaan (koska se on pieni eikä vie tilaa nimeltä).

```tsx
<div className="mb-3">
  <div className="flex items-start justify-between gap-2">
    <div className="min-w-0 flex-1">
      <p className="text-base font-bold leading-tight break-words">
        {athlete.surname} {athlete.firstname}
      </p>
      {athlete.organization && (
        <p className="truncate text-xs text-muted-foreground">
          {athlete.organization}
        </p>
      )}
    </div>
    <Button variant="ghost" size="sm" onClick={() => remove(athlete.key)}
      aria-label="Poista seurannasta" className="shrink-0 -mr-2 -mt-1">
      <X className="h-4 w-4" />
    </Button>
  </div>
  <div className="mt-2">
    <Link to="/athlete/$key" params={{ key: athlete.key }}
      className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
      Urheilijatilastot
    </Link>
  </div>
</div>
```

### `src/components/ResultVideoButton.tsx`
- Selkeytetään tyyliä niin, että nappi näyttää aina samanlaiselta punaiselta YouTube-painikkeelta, sekä silloin kun videoita on että kun niitä ei ole. Kirjautumaton käyttäjä näkee napin vain silloin, kun julkisia videoita on saatavilla (kuten nyt).

```tsx
className={`${btnClass} transition-colors bg-red-500/10 text-red-600
  hover:bg-red-500/20 dark:text-red-400`}
```

- Näytetään aina "Video" -teksti (ja lukumäärä sulkeissa jos > 1), jotta nappi on selkeästi tunnistettavissa myös kapealla näytöllä:

```tsx
<Youtube className={iconClass} />
<span>Video{videos.length > 1 ? ` (${videos.length})` : ""}</span>
```

### `src/routes/watch.tsx` (rivit 826–844)
- Pidetään `ResultVideoButton` rivin alla omana rivinään oikealle tasattuna (nykyinen `mt-1 flex justify-end pr-1` on ok).
- Käytetään `size="sm"`, jotta nappi on kosketusystävällinen mobiilissa.

## Ei muuteta
- Videokyselyn logiikkaa (`videosByAthlete` / `["athlete-videos", key]`) — se toimii jo.
- Muita näkymiä (round-, athlete-sivut) — sama komponentti hyötyy tyylimuutoksesta automaattisesti, mutta muu asettelu säilyy.
- Tietokantaa tai RLS:ää.

## Vahvistus
- Playwright-ajolla mobiiliviewportissa (375px): otetaan kuvakaappaus `/watch`-sivusta ja todetaan että
  1. nimi näkyy kokonaan,
  2. Urheilijatilastot-nappi on nimen alla,
  3. jokaisen lajin alla näkyy punainen "Video"-painike (kirjautuneena).
