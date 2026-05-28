## Ongelma

N 100m Hyvän Tuulen Kisat 1: Emma Koponen näkyy "Alkuerät sija 6 · 12,58", vaikka hän juoksi loppukilpailussa sijalle 7. Harvesteri valitsee tällä hetkellä **parhaan** numeerisen ajan kaikista kierroksista, joten alkuerien nopeampi 12,58 voittaa loppukilpailun hitaamman ajan — ja virallinen finaalisijoitus katoaa.

## Korjaus

`src/routes/api/public/hooks/harvest-results.ts` — Track-lajien (`isTrack`) valintalogiikkaan (rivit ~240–254). Vaihdetaan sääntö:

1. **Käytä viimeisintä kierrosta**, jos siinä on numeerinen tulos (finaali on virallinen).
2. Jos viimeisin on ei-numeerinen (DNS/DNF/DQ), käytä parasta numeerista aikaisemmista kierroksista ja merkitse `result_round_name` siitä erästä (tämä on alkuperäinen Tobias-tapaus).
3. Jos missään kierroksessa ei ole numeerista, käytä viimeisintä riviä (esim. pelkkä DNS).

Käytännössä:

```
if (isTrack) {
  const latestNumeric = t.latest.result_numeric != null;
  if (latestNumeric) {
    out = { ...t.latest };
    // Näytä erän nimi jos kilpailussa oli useita kierroksia ja viimeisin EI ole "varsinainen" tulos?
    // → ei, älä näytä round_namea kun latest on numeerinen — sijoitus on jo finaalin sija
    out.result_round_name = "";
  } else if (t.best) {
    // Viimeinen kierros DNS/DNF → varaudutaan paras aiempi + erän nimi
    out = { ...t.best };
    out.result_round_name = t.bestRoundName;
  } else {
    out = { ...t.latest, result_round_name: "" };
  }
}
```

## Vaikutukset

- **Emma Koponen N 100m**: näyttää nyt finaalin sijan 7 (oikea virallinen tulos).
- **Tobias Moreno M 100m**: edelleen "Alkuerät sija 5 · 10,87" koska loppukilpailussa DNS → fallback paras alkuerästä toimii.
- PB-laskenta (`mark_pbs_for_competitions`) on jo erillinen: se käy läpi **kaikki rivit** (kaikki kierrokset) eikä riipu tästä valinnasta, joten alkuerien nopeampi aika rekisteröityy edelleen PB:ksi jos se sellainen on.

⚠️ Huom: tällä hetkellä `athlete_results`-taulussa on jo *parhaan kierroksen* rivi per (urheilija, laji, kisa). Harvesteri **upsertaa** seuraavalla ajollaan saman avaimen päälle, joten Emma Koposen rivi päivittyy automaattisesti finaalitulokseksi kun kisa tulee uudelleen revisit-skannaukseen (mikä tapahtuu joka ajossa lähipäivien kisoille). Migraatiota tai backfilliä ei tarvita.

## Mitä ei muuteta

- UI (`ClubTodaySection.tsx`) — näyttää edelleen `result_round_name` jos se on tallessa.
- PB-logiikka, tulosteet, tietokantaskeema.
