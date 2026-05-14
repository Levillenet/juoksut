## Uusien ennätysten korostaminen tähdellä

### Nykytila
Kuuluttajan näkymä (`src/routes/announcer.tsx`) **havaitsee jo** uudet PB- ja SB-tulokset funktiolla `detectRecord` vertaamalla API:n palauttamaa `Result`-arvoa lähtörivin `PB`- ja `SB`-arvoihin. Tällä hetkellä merkintä näkyy pienenä värillisenä laatikkona ("Uusi PB" / "Uusi SB").

### Mitä muutetaan
Vaihdetaan badge-tyyli niin, että teksti **PB** tai **SB** näkyy keltaisen tähden sisällä — selvästi erottuva merkki sekä käynnissä olevissa että valmistuneissa lajeissa.

```text
        ★          ★
       PB         SB
```

### Toteutus

1. **Uusi pieni komponentti `RecordStar`** samaan tiedostoon (`src/routes/announcer.tsx`):
   - Käyttää `lucide-react`:in `Star`-ikonia taustalla (täytetty kullanvärinen, esim. `fill-yellow-400 text-yellow-400`)
   - Päälle absoluuttisesti aseteltu pieni teksti "PB" tai "SB" (musta, lihavoitu, hyvin pieni)
   - Tooltip (`title`-attribuutti): "Uusi oma ennätys" / "Uusi kauden ennätys"
   - Kaksi kokoa: iso (käynnissä-/valmiit-kortit) ja pieni (laajennettu lista)

2. **Korvataan kaksi kohtaa** announcer.tsx:ssä:
   - Rivit 468–479: iso versio (EventCard-kortin tulosrivit)
   - Rivit 579–590: pieni versio (laajennettu osallistujalista)

   Molemmissa nykyinen `<span>`-badge → `<RecordStar kind={rec} size="lg|sm" />`.

3. **Logiikkaan ei kosketa** — `detectRecord` toimii jo oikein:
   - Juoksuissa pienempi tulos voittaa
   - Hypyt/heitot suurempi voittaa
   - Tyhjä PB/SB → ei merkintää (ei vahvistettavissa)

### Mitä EI tehdä
- Ei muuteta muita näkymiä (lajisivu, etusivu, hakusivu) — pyysit vain kuuluttajan näkymään
- Ei lisätä erillistä "Päivän ennätykset" -listaa
- Ei snapshotata kisan alun PB-arvoja — käytetään API:n antamaa arvoa, joka edustaa lähtörivin tilannetta

### Tekninen huomio
`Star`-ikoni on jo asennetussa `lucide-react`-kirjastossa. Tähden sisään tulevan tekstin asettelu tehdään `relative`/`absolute`-yhdistelmällä (`inline-flex` + `<span className="absolute inset-0 flex items-center justify-center">`).
