## Tutkimusraportti — miksi YAG (kopio) generoituu huonosti

### Mitä löysin

**1. Päivän aikaikkunat (`day_windows`) ovat liian lyhyet**

| Päivä | YAG (kopio) DB | Oikea YAG 2026 | Erotus |
|---|---|---|---|
| 12.6 PE | 09:00–17:00 = **8 h** | 12:00–20:25 = **8 h 25 min** | ~OK |
| 13.6 LA | 09:00–17:00 = **8 h** | 08:55–20:00 = **11 h 5 min** | **−3 h** |
| 14.6 SU | 09:00–17:00 = **8 h** | 09:00–20:30 = **11 h 30 min** | **−3,5 h** |
| **Yht.** | **24 h** | **31 h** | **−7 h (−23%)** |

Pelkästään tämä leikkaa kapasiteetista lähes neljäsosan. Kaikki ne lajit, jotka oikeassa YAG:ssa pidetään klo 17:00 jälkeen (pituushyppy, kuula, kiekko, keihäs, korkeus iltapäivinä, viestit klo 18–20), eivät mahdu nykyiseen päivään.

**2. Suorituspaikkoja on liian vähän — paikat eivät vastaa todellisuutta**

YAG (kopio) `plan_venues` (10 kpl):
| kind | määrä | nimet |
|---|---|---|
| high_jump | 1 | Korkeushyppy |
| jump_pit | 3 | Pituuskuoppa A, Pituuskuoppa B, Kolmiloikka |
| pole_vault | 1 | Seiväshyppy |
| shot_ring | 1 | Kuulakehä |
| throw_cage | 1 | Kiekkokehä |
| throw_runway | 1 | Keihäsvauhdinotto |
| track_oval | 1 | Rata |
| track_straight | 1 | Pikajuoksusuora |

Oikea YAG 2026 -ohjelmassa näkyvät suluissa olevat sijainnit:
- **Kuula** kahdessa paikassa (K, L) — kopio: vain 1
- **Kiekko/Moukari**: I etukaarre + "ulkoheittopaikka" — kopio: 1 throw_cage
- **Keihäs**: J1 etukaarre + J2 takakaarre + ulkoheittopaikka — kopio: 1 throw_runway
- **Korkeus**: D + E — kopio: 1
- **Seiväs**: F + G — kopio: 1
- **Pikajuoksu**: etusuora (ES) + takasuora (TS) — kopio: 1 track_straight + 1 track_oval

Klo 12:00 perjantaina käynnistyy oikeassa YAG:ssa **6 lajia samaan aikaan** eri paikoilla. Kopio-suunnitelmalla niitä voi käynnistyä korkeintaan 8 (yksi per venue-kind), mutta käytännössä rajoitteet (kuula vain 1, korkeus vain 1, jne.) pakottavat kaiken serialisaation.

**3. Lajeja on 166, kaikilla `allowed_days = NULL`**

Allowed_days ei rajoita — kaikki päivät sallittu. Hypoteesi C kumottu.

**4. Sijoittamatta jääneet lajit (n. 93 kpl) ovat lähes kaikki single-vaiheen kenttälajeja ja pitkiä juoksuja**

Esimerkkejä: P10 Pituus (35 osall.), P10 Keihäs (31), P12 Kiekko (38), P11 Korkeus (23), N15 Kuula (16), kaikki 800m a/b -lajit P10–P13. Oikeassa YAG:ssa nämä menevät klo 16:00–20:30 — meidän window loppuu klo 17.

### Hypoteesien ratkaisu

- **A (day_windows rikki)** ✓ — osittain. Ikkunat eivät ole tyhjiä, mutta liian lyhyet (3 h/päivä liian aikaisin).
- **B (heats täyttävät päivän)** — pieni vaikutus. Sortti laitettiin korjaamaan VAIHE A:ssa, mutta vaikka heats menisi loppuun, päivä loppuisi silti klo 17.
- **C (allowed_days rajoittava)** ✗ kumottu.
- **D (ei rinnakkaisia paikkoja)** ✓ — kriittinen. Vain 1 throw_cage, 1 shot_ring, 1 high_jump → kaikki saman kindin lajit pakkoserialisoidaan. Oikeassa YAG:ssa on 2–3 paikkaa per kind.

### Kapasiteettilaskelma

24 h × 10 paikkaa = **240 venue-tuntia**. Tarvittava karkea arvio (166 lajia × keskim. 30 min) ≈ 83 h. Periaatteessa mahtuisi, **mutta pullonkaula on per-kind**:
- Kuula: 15 lajia × ~50 min = **12,5 h** yhdellä paikalla — vie koko 24 h:sta yli puolet.
- Korkeus: 13 lajia × ~80 min = **17 h** yhdellä paikalla — käytännössä ei mahdu kolmeen 8 h päivään (yli 6 h/päivä yhdellä paikalla = lukkiutuu kun ikäryhmä on busy muualla).
- Keihäs: 11 × ~50 min = **9 h** yhdellä paikalla.
- Track_oval (kaikki ≥300m): kymmeniä lajeja samalle ovaalille.

### Pää-syy

**Pää-syy generointiongelmiin on: virheellinen data, ei solver-koodi.** Kaksi data-ongelmaa yhdessä:
1. `day_windows` 3 tuntia liian lyhyt per päivä (23 % vähemmän aikaa kuin oikeassa YAG:ssa)
2. `plan_venues` puuttuu rinnakkaisia paikkoja: kuula (1→2), korkeus (1→2), seiväs (1→2), keihäs (1→3), kiekko/moukari (1→2), pikajuoksusuora (käytännössä 2 erillistä: ES + TS, nyt vain "Pikajuoksusuora"+"Rata")

**Korjataan: dataa, ei koodia.**

Solverin VAIHE A–C -korjaukset ovat edelleen tarpeen ja toimivat oikein (heats ennen finaalia, kestot oikein, A/B peräkkäin). Niitä ei muuteta.

### Konkreettinen ensimmäinen askel

Päivitetään `competition_plans.day_windows` YAG (kopio) -suunnitelmalle vastaamaan todellisia aikoja:
```json
[
  {"date":"2026-06-12","start":"12:00","end":"20:30"},
  {"date":"2026-06-13","start":"08:55","end":"20:00"},
  {"date":"2026-06-14","start":"09:00","end":"20:30"}
]
```

Pelkkä tämä muutos antaa solverille **+7 tuntia kapasiteettia** ja todennäköisesti pudottaa "ei mahdu" -varoituksia merkittävästi (arvio: 200 → 50–80).

### Seuraavat askeleet (testattavaksi yksi kerrallaan)

**A. Pidennä day_windows** (1 SQL-migraatio, ei koodimuutosta) → aja generointi → raportoi konfliktien ja warningien määrä.

**B. Lisää puuttuvat paikat** (`plan_venues` insertit, ei koodimuutosta):
- 2. shot_ring "Kuulakehä L"
- 2. high_jump "Korkeushyppy E"
- 2. pole_vault "Seiväs G"
- 2.–3. throw_runway "Keihäs J2", "Keihäs ulko"
- 2. throw_cage "Ulkoheittopaikka"
- (Mahd.) erottaa track_straight kahteen: ES + TS

**C. Vasta jos A+B eivät riitä**, palataan koodiin (esim. lisätään `lanes` per track-venue → moni heats samalla ovaalilla).

### Mitä EI tehdä nyt

- Ei muuteta solveria.
- Ei muuteta planner-rules.ts -kestolaskentaa.
- Ei muuteta `isVenueForEvent`-logiikkaa.
- Ei tehdä YAG-pohjadatan muutoksia muille suunnitelmille — vain tähän kopioon.

Odotan vihreää valoa askeleen A toteutukseen (day_windows-päivitys).
