# Lataa PDF -toiminto YAG Calling -näkymään

Muutetaan nykyiset "Tulosta / PDF" -painikkeet "Lataa PDF" -painikkeiksi, jotka generoivat PDF-tiedoston suoraan ja lataavat sen käyttäjän laitteelle ilman selaimen tulostusikkunaa.

## Toteutus

**1. Lisätään PDF-kirjasto**
- `jspdf` + `jspdf-autotable` taulukkojen layoutiin (kevyt, toimii selaimessa, ei vaadi serveriä).

**2. Uusi apufunktio `src/lib/yag-calling-pdf.ts`**
- Ottaa parametreinaan: `grouped` (päiväkohtaiset rivit), `compName`, `orientation`, `mode`, `orgName`/`watchedCount`.
- Rakentaa PDF:n:
  - Otsikko: kisan nimi + "Calling-aikataulu"
  - Alaotsikko: "Seurannassa olevien urheilijoiden lähdöt" / "Seuran X urheilijoiden lähdöt"
  - Päivä-osio per päivämäärä (DATE_LABEL)
  - Taulukko: Calling | Kentälle | Alkaa | Sarja / Laji + urheilijat | Erä | Paikka
  - Julkaisemattomat erät: listataan kaikki erän ajat samalle riville (kuten nyt UI:ssa)
  - Alatunniste: lähde + tulostusaikaleima + sivunumero
- Sivun koko A4, orientaatio käyttäjän valinnan mukaan, marginaalit kuten `usePrintOrientation` (~8mm/10mm).
- Tallennus: `doc.save("yag-calling-<mode>-<aikaleima>.pdf")` → lataus sekä työpöydällä että mobiilissa.

**3. Päivitetään `src/routes/print.yag-calling.tsx`**
- Lisätään `handleDownload`, joka kutsuu uutta apufunktiota.
- Vaihdetaan molempien painikkeiden teksti "Tulosta / PDF" → "Lataa PDF" (mobiili: "Lataa").
- Vaihdetaan ikoni `Printer` → `Download` (lucide-react).
- Poistetaan `window.print()` -kutsu ja `auto`-haun automaattinen `window.print()` → korvataan automaattisella latauksella jos `?auto=1`.
- Painikkeet pysyvät disabloituina jos `grouped.length === 0`.

**4. Säilytetään muuttumattomana**
- Näytön layout ja suodattimet (Seurannassa / Oma seura, seuravalitsin).
- Suuntavalitsin (Pysty/Vaaka) — vaikuttaa nyt vain PDF:n orientaatioon, ei selaimen tulostukseen.
- Print-tabit, muut printtinäkymät (`print.club`, `print.watched`) ei mukana — käyttäjä pyysi vain YAG-näkymän.

## Tekniset yksityiskohdat

- Fontti: jsPDF:n oletus Helvetica riittää (suomenkieliset perusmerkit ä, ö toimivat WinAnsi-koodauksella).
- Tiedostonimi: `yag-calling-watched-2026-06-11.pdf` tai `yag-calling-<seurannimi-slug>-<pvm>.pdf`.
- Riippuvuus asennetaan `bun add jspdf jspdf-autotable` -komennolla rakennusvaiheessa.

## Tiedostot
- **Uusi**: `src/lib/yag-calling-pdf.ts`
- **Muokataan**: `src/routes/print.yag-calling.tsx`
- **package.json**: lisätään `jspdf`, `jspdf-autotable`
