## Tavoite

Maksimoi UI:n luettavuus auringonpaisteessa puhelimella, ilman erillistä kytkintä — muutokset toimivat myös sisällä ja nostavat metatekstit WCAG AA -tasolle.

## Muutokset (vain `src/styles.css`)

### `:root` (vaalea teema)

| Token | Nyt | Uusi |
|---|---|---|
| `--background` | 0.985 0.005 250 | **1 0 0** (puhdas valkoinen) |
| `--foreground` | 0.18 0.04 260 | **0.12 0.04 260** |
| `--muted-foreground` | 0.45 0.03 258 | **0.32 0.03 258** |
| `--border` | 0.929 0.013 255 | **0.82 0.015 255** |
| `--input` | 0.929 0.013 255 | **0.78 0.015 255** |
| `--ring` | 0.704 0.04 256 | **0.45 0.18 28** |
| `--primary` | 0.55 0.21 28 | **0.48 0.22 28** |
| `--secondary` | 0.96 0.01 250 | **0.93 0.01 250** |
| `--muted` | 0.95 0.01 250 | **0.92 0.01 250** |
| `--accent` | 0.92 0.05 90 | **0.88 0.10 85** |
| `--accent-warm-border` | 0.82 0.12 80 | **0.70 0.16 80** |
| `--destructive` | 0.577 0.245 27 | **0.50 0.24 27** |
| `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground` | nykyiset | linjataan **0.12 0.04 260**:een |
| `--sidebar-foreground`, `--sidebar-accent-foreground` | nykyiset | tummennetaan vastaavasti |

### `.dark` (tumma teema, pieni viilaus)

- `--muted-foreground`: 0.704 → **0.78**
- `--border`: 1 0 0 / 10% -tyylinen → hieman erottuvampi (jos arvo on opaakki, nostetaan luminanssia ~0.05)

### Globaalit `@layer base` -lisäykset

```css
@layer base {
  html { -webkit-text-size-adjust: 100%; }
  body { text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; }
  * { -webkit-tap-highlight-color: transparent; }
}

@media (prefers-contrast: more) {
  :root {
    --foreground: oklch(0.05 0 0);
    --muted-foreground: oklch(0.22 0.03 258);
    --border: oklch(0.65 0.02 255);
    --input: oklch(0.62 0.02 255);
  }
}
```

## Mitä EI muuteta

- Komponentteja, layoutteja, fontteja
- Toiminnallisuuksia, reittejä, kuuluttaja-/live-näkymiä
- Asetuksia (ei uutta kytkintä)

## Vahvistus toteutuksen jälkeen

Avaan etusivun mobiili-viewportilla (390×844) ja varmistan visuaalisesti, että:
- Leipäteksti, otsikot ja metatekstit erottuvat selvästi
- Korttien rajat näkyvät
- Punainen primary-painike säilyy elinvoimaisena
