## Mistä on kyse

Amanda Gustafssonin tämän päivän korkeus 110 (aiempi paras 97) on tietokannassa merkitty `was_pb = false`, joten etusivun listalla ei näy PB-merkkiä eikä parannusta. Varmistetut faktat:

- Lohja Junior Games (kisa 20126): 456 tämän päivän riviä, joista **0** on merkitty ennätykseksi. Eilisen ajossa merkinnät syntyivät normaalisti (mm. pituus 3,31 = PB).
- Muut tänään haetut kisat (20128, 20145, 19136 jne.) saivat PB-merkinnät normaalisti.
- Tietokannan lokissa on kaksi virhettä "canceling statement due to statement timeout" 26.7. klo 11:25:05 ja 11:25:13, eli heti kisan 20126 haun (klo 11:24:56) jälkeen.
- Ennätyslaskenta `mark_pbs_for_competitions` vertaa jokaista riviä kaikkiin saman urheilijan riveihin erillisellä alikyselyllä. Kisassa on 598 urheilijaa ja 1417 riviä, joten kysely kasvaa neliöllisesti ja ylittää aikarajan.
- Haussa laskennan virhe vain kirjataan konsoliin, joten epäonnistuminen jää huomaamatta eikä sitä yritetä uudelleen.

Käyttöliittymä toimii oikein: PB-merkki ja parannus näytetään heti kun tietokannan lippu on kunnossa. Sama vika selittää myös yksittäisiä vääriä merkintöjä vanhemmissa riveissä (esim. korkeus 96 merkitty PB:ksi vaikka aiempi 97 oli parempi), koska osa ajoista on jäänyt kesken.

## Mitä korjataan

1. **Laskenta kevyemmäksi.** Ennätyslaskenta kirjoitetaan uudelleen ikkunafunktioilla (juokseva paras aiempi tulos aikajärjestyksessä) neliöllisen alikyselyn sijaan. Sama tulos, murto-osa ajasta.
2. **Palastelu.** Laskenta ajetaan urheilijaryhmissä (esim. 100 urheilijaa kerrallaan), jotta yksikään kysely ei pääse lähelle aikarajaa isoissakaan kisoissa.
3. **Virheiden huomaaminen ja uudelleenyritys.** Jos laskenta epäonnistuu, se yritetään uudelleen ja epäonnistuneet kisat merkitään uudelleenlaskettaviksi seuraavalla ajolla sen sijaan, että virhe hukkuisi lokiin.
4. **Nykytilanteen korjaus.** Kisan 20126 ennätysliput lasketaan kerran uudelleen palastellusti, jolloin Amandan korkeus 110 ja muut päivän ennätykset tulevat heti näkyviin oikein.

## Tekniset yksityiskohdat

- Migraatio: `public.mark_pbs_for_competitions(int[])` uudelleen ikkunafunktiolla; lisäksi uusi `public.mark_pbs_for_athletes(text[])` jota haku kutsuu erissä. Hyödynnetään olemassa olevaa indeksiä `idx_ar_pbkey_result`.
- Järjestyssääntö säilyy ennallaan: `competition_date`, sitten `captured_at`, sitten `id`; `Track` = pienempi parempi, muut = suurempi parempi; ryhmittely `event_pb_key(event_name, age_class)`.
- `src/routes/api/public/hooks/harvest-results.ts`: `mark_pbs`-kutsu muutetaan urheilijaeräkohtaiseksi, lisätään yksi uudelleenyritys ja epäonnistuneen kisan merkintä uudelleenlaskentaan (`harvest_competitions.done = false`).
- Frontendiin ei muutoksia.
