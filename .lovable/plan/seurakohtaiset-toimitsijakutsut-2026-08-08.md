# Seurakohtaiset toimitsijakutsut

## Mitä rakennetaan

1. **Seura toimitsijaprofiiliin (viimeistely)**
   - Profiilissa on jo Seura-kenttä, mutta se on vapaa tekstikenttä. Lisätään ehdotuslista jo käytössä olevista seuroista (esim. Lahden Ahkera), jotta kirjoitusasu pysyy yhtenäisenä.
   - Seura näytetään toimitsijakorteissa ja ehdotuslistoissa järjestäjän näkymässä.

2. **Toimitsijahaun kohdistaminen seuroille**
   - Kun toimitsijavastaava avaa haun kilpailulle, hän valitsee mille seuroille kutsu suunnataan (yksi tai useampi).
   - Jos yhtään seuraa ei valita, haku on avoin kaikille toimitsijoille (nykyinen toiminta säilyy).
   - Avatun haun kortissa näkyy kohdeseurat, ja niitä voi muokata hakua sulkematta.

3. **Toimitsija näkee vain itselleen suunnatut kutsut**
   - Toimitsijan etusivulla ("Kilpailun järjestelyt") avoimien hakujen listassa näytetään vain ne haut, jotka on suunnattu kaikille tai hänen oman seuransa toimitsijoille.
   - Jos toimitsijalla ei ole seuraa profiilissa, näytetään huomautus: "Lisää seura profiiliisi nähdäksesi seurallesi suunnatut kutsut".
   - Kutsukortissa näkyy merkintä, esim. "Suunnattu: Lahden Ahkera".

4. **Varmennuspyynnöt ja ehdotukset**
   - Kun haku on kohdistettu seuroille, järjestäjän toimitsijaehdotukset nostavat ensisijaisesti kohdeseurojen toimitsijat, mutta muutkin voi edelleen asettaa käsin.

## Tekniset yksityiskohdat

- **Tietokantamuutos**: `official_competition_calls`-tauluun uusi sarake `target_clubs text[] not null default '{}'`. Tyhjä taulukko tarkoittaa "kaikille".
- **src/lib/officials.ts**: `OfficialCall` ja `OfficialCallFull` saavat `target_clubs`-kentän, `openCall` ottaa sen vastaan, uusi `updateCallTargetClubs()` ja apufunktio `fetchKnownClubs()` (distinct `club` arvot `official_profiles`-taulusta).
- **src/routes/toimitsija.kisa.$competitionId.tsx**: hakua avattaessa seuravalitsin (valintaruudut tunnetuista seuroista + vapaa lisäys), avatun haun kortissa kohdeseurojen näyttö ja muokkaus.
- **src/routes/toimitsija.index.tsx**: avointen hakujen suodatus profiilin seuran mukaan, seuramerkintä kortissa, ohje puuttuvasta seurasta.
- **Näkyvyys**: suodatus tehdään käyttöliittymässä; taulun lukuoikeudet pysyvät ennallaan, koska kutsutiedot eivät ole arkaluontoisia.
