# Rajapinta toimii, mutta hakusykli jumittaa lukkoon

## Mitä mittasin juuri nyt

- Tuloslistan rajapinta vastaa normaalisti: proxy-kutsut palauttivat 200, kisalista ja aikataulu päivittyivät tuoreiksi (ikä 10-20 s), eikä `harvest_state`-taulussa ole estoa (`blocked = false`, ei virheitä).
- Tuloksia tulee: viimeisin tallennus 10:20, viime tunnin aikana 296 uutta tulosriviä (mm. pm-huipentuma, Nastokisat, Kipinän Kisat, Toijala Junior Games).
- Ongelma on päivitystiheydessä: tuloksia kirjautuu vain noin 10 minuutin välein (10:20, 10:10, 09:40, 09:30...), vaikka ajastus on 5 minuuttia ja nopean syklin pitäisi tuoda dataa käynnissä olevista kisoista tiheämmin.

## Juurisyy

Molemmat ajastetut haut (koko haku ja nopea "hot"-haku käynnissä oleville kisoille) käynnistyvät samalla minuutilla ja jakavat saman globaalin lukon. Nopea haku palauttaa joka kerta `{"ok":true,"skipped":"locked"}`, eli se ei ole ajanut kertaakaan viimeisen tunnin aikana. Koko haun HTTP-vastaus jää usein kokonaan saamatta (aikakatkaisu), jolloin lukkoa ei vapauteta hallitusti ja seuraavatkin ajot ohittuvat.

Lukko on toteutettu istuntokohtaisella advisory-lukolla, joka jää roikkumaan yhteyspoolissa, jos ajo katkeaa kesken. Siksi hakusykli hidastuu käytännössä 10 minuuttiin, ja käyttäjälle näkyy "ei päivity".

## Korjaus

1. Vaihda lukko aikaleimapohjaiseksi tauluun (esim. `harvest_locks`: lukon nimi, haltija, `expires_at`). Lukko vanhenee itsestään 2-3 minuutissa, joten katkennut ajo ei voi jumittaa sykliä.
2. Erota lukot: koko haulla ja nopealla hot-syklillä oma lukkonsa, jotta ne eivät estä toisiaan.
3. Porrasta ajastukset: koko haku parillisiin viisiminuutteihin, hot-sykli omalla rytmillään, ja nosta hot-syklin taajuutta (1 minuutti) käynnissä olevien kisojen ajaksi.
4. Rajaa koko haun kesto (aikabudjetti, esim. 20 s per ajo) ja vapauta lukko aina `finally`-haarassa, myös virhetilanteessa.
5. Lisää ylläpitonäkymään lyhyt tila: milloin lukko on varattu, milloin viimeisin onnistunut hot-sykli ajoi ja montako tulosta se kirjasi.

## Tekniset kohteet

- `src/routes/api/public/hooks/harvest-results.ts`: lukon otto/vapautus, hot- ja täysajon eriyttäminen, aikabudjetti.
- Tietokanta: uusi `harvest_locks`-taulu sekä `harvest_try_lock` / `harvest_unlock` uusiksi vanhenevalla lukolla (GRANTit service_rolelle).
- Cron-ajastukset (jobit 14 ja 15): eri minuutit, hot-syklille tiheämpi rytmi.
