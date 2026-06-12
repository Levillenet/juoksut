## Suorituspaikan livenäytön skrollaus (Kaikki-tila)

### Tavoite
Suorituspaikan livenäytössä (`/scoreboard`) lisätään "Kaikki"-vaihtoehto osallistujamäärän valintaan. Kun "Kaikki" on valittu, sivu on skrollattava eikä pakota kaikkea yhdelle ruudulle.

### Nykytila
- Top 3 / 5 / 10 näyttää vain kärkitulokset ja pakkaa ne yhdelle näytölle (`h-screen`, `overflow-hidden`, `flex: 1` riveillä)
- Kaikkia osallistujia ei voi kerralla nähdä

### Muutokset

**1. TopSize-tyyppi laajenee "all"-vaihtoehdolla**
```
TopSize: 3 | 5 | 10 | "all"
```

**2. Uusi "Kaikki"-painike**
- Lisätään Top 3 / 5 / 10 -valitsimen rinnalle "Kaikki"-nappi
- Painikkeiden järjestys: Top 3 | Top 5 | Top 10 | Kaikki

**3. Skrollattava tila kun `top === "all"`**
- Ulkoinen kontti: `min-h-screen` (ei `h-screen`) ja `overflow-auto` (ei `overflow-hidden`)
- `<main>`: `overflow-auto` (ei `overflow-hidden`)
- Rivien `<ul>`: `overflow-auto` (ei `overflow-hidden`)
- Yksittäiset rivit: poistetaan `flex: 1 1 0` ja kiinteät korkeudet — korvataan `auto`-pohjaisella korkeudella
- Fonttikoot: käytetään vakiofonttikokoja (ei viewport-pohjaisia), koska skrollaavassa näkymässä korkeus ei määritä tekstin kokoa

**4. Kiinteä näkymä säilyy Top 3/5/10 -tilassa**
- Kun valittuna on 3, 5 tai 10, nykyinen toiminta säilyy täysin ennallaan (yksi näyttö, ei skrollausta)

**Tiedosto:** `src/routes/scoreboard.tsx`