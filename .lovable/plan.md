## Ongelma

"Seuran urheilijat tänään" -näkymässä (etusivu → ClubTodaySection) PB-parannus näytetään vain jos aiempi PB löytyy täsmälleen samalla `pbEventKey`-avaimella (event_name + age_class). Kun urheilija tekee ensimmäisen tuloksensa uudessa ikäluokassa (esim. Aavikko Siiri T11 Moukari 18,85), edellistä PB:tä ei löydy ja parannuslukua ei näytetä – vaikka `was_pb` on tosi.

## Ratkaisu

Kun edellistä PB:tä ei löydy nykyisellä `pbEventKey`-avaimella, käytetään fallbackia: sama urheilija + sama normalisoitu lajinimi (ilman ikäluokka-erottelua) → lähin historiallinen tulos vertailuun. Näin ikäluokan vaihtuessa (esim. T13 Moukari → T11 Moukari) parannus lasketaan edelliseen ikäluokkatulokseen.

## Muutokset

### 1. `src/lib/club-today.ts`
- `fetchClubPbs` rakentaa nyt vain `pbEventKey`-mappia. Lisätään toinen paluukartta: `fallbackByName` = `${athlete_key}|${normalizeEventName(event_name)}` → paras historiallinen tulos ilman age_class -erottelua (mutta samaa event_category).
- Palautetaan sekä ensisijainen (`ClubPbMap`) että fallback-kartta.
- `fetchClubPreviousPbs` välittää molemmat.

### 2. `src/components/ClubTodaySection.tsx`
- Muuttujat `pbs` ja `pbsFallback` erikseen.
- Rivin renderöinnissä: jos `pb` ei löydy pääkartasta, katsotaan `pbsFallback`. Jos fallback-tulos on parempi kuin nykyinen ja `was_pb` on tosi, käytetään sitä improvement-laskuun.
- Näytön tekstiin (esim. "ed. PB 22,15 (T13)") lisätään pieni vihje kun vertailu on eri ikäluokasta – luetaan fallback-rivin `age_class`.
- `pb`-lookup-avain säilyy pääkartassa; fallback vain kun pääkartta puuttuu.

### 3. Ei tietokantamuutoksia
Kaikki data on jo `athlete_results`-taulussa. Ei uusia migraatioita.

## Verifiointi
Etusivu → valitse Aavikko Siirin seura → T11 Moukari 18,85 -rivillä pitäisi näkyä PB-badge parannuksella verrattuna edellisen ikäluokan (esim. T13) parhaaseen moukaritulokseen, ja tekstissä mainittava mistä ikäluokasta vertailu on.
