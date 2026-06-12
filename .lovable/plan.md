## Kilpailijaseurannan jakamisen korostaminen

Kaksi muutosta korostamaan seurannan jakamista:

### 1. Header-nappi tekstillä
- Muuta `ShareWatchButton` headerissa pelkästä ikonista teksti-ikoninapiksi.
- Teksti: **"Jaa seuranta"** + `Share2`-ikoni.
- Käytä esim. `variant="outline"` tai `variant="default"` korostusta varten.
- Säilytä sama popover-toiminnallisuus.

### 2. Pehmeä kutsu-banneri sivulle
- Lisätään sivun yläosaan (pääsisällön alkuun, ennen seurattavien listaa) näkyvä banneri/kortti, joka ilmestyy vain kun urheilijoita on valittu seurantaan.
- Teksti: *"Jaa kilpailijaseuranta tutuille tai kavereille, jolloin he pääsevät näkemään myös saman näkymän ja seuraamaan ja jännittämään kilpailun suorituksia."*
- Mukana **"Kopioi linkki"**-nappi (käyttää samaa `useWatchShare`-hookia) ja/tai **"Jaa"**-nappi natiivijakoa varten.
- Tyyli: pehmeä taustaväri (`bg-accent/30` tai `bg-primary/10`), selkeä mutta siro.