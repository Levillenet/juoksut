## Valikko-oletus ja tyyli

### Muutokset etusivulle (`src/routes/index.tsx`)

1. **Piilota valikko oletuksena**
   - Muuta `navCollapsed`-oletusarvo `false` -> `true`
   - `localStorage`-arvo säilyy ennallaan: käyttäjä voi avata valikon ja seuraavalla latauksella se on auki

2. **Teksti: "VALIKKO"**
   - Korvaa "Näytä pikavalikko" / "Piilota pikavalikko" -> yksinkertaisesti **"VALIKKO"**
   - Poista chevron-ikoni (nuoli ylös/alas) koska nappi toimii pelkästään toggle-tekstinä

3. **Korostus: suurempi fontti + punainen**
   - Fonttikoko: `text-sm` -> `text-base` tai `text-lg`
   - Väri: punainen (`text-red-500` tai design tokenilla `text-destructive`)
   - Fontti: bold

### Tekninen toteutus
- Yksittäinen tiedosto: `src/routes/index.tsx`
- Ei uusia riippuvuuksia
- Ei tietokantamuutoksia
