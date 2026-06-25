## Ongelman juurisyy

Tarkistettu live-datasta (kilpailu 19739, M-SM-2026): nais­ten klo 08:00 kävelyt eivät käytä samaa matkaa:
- N30/N35/N45/N50/N55 → "5000m kävely"
- N60/N65/N70/N75/N80 → "3000m kävely"

Eli lähtö on yhteinen mutta matka eri. Nykyinen niputus käyttää avaimena `BeginDateTimeWithTZ + Gender + lajinimi (ilman ikää) + roundName`, joten 5000 m ja 3000 m menevät kahteen eri ryhmään, ja toinen niistä jää piiloon korttina jonka käyttäjä klikkasi. Tämän takia näytti, että "nappi ei tee mitään": ryhmiä syntyi, mutta useampi pieni ryhmä eikä yhtä isoa.

## Muutos

Vaihdetaan niputus tunnistamaan "saman lähdön": **start-time + gender + round-phase (Name)**, matkasta riippumatta. Toimitsijan käyttötapa = "huuda klo 11 viivalle" → kaikki samana hetkenä starttaavat saman sukupuolen kävelijät/juoksijat yhdellä kortilla, riippumatta siitä että toiset menevät 3000 m ja toiset 5000 m.

### `src/lib/round-grouping.ts`
- `groupKey(r)` = `${BeginDateTimeWithTZ}|${Gender}|${Name}` (poistetaan `baseName` avaimesta).
- Ryhmän esitysnimi: yhdistetään ryhmän jäsenten `stripAgeFromEventName`-tulokset uniikkina listana ja näytetään ne joko yhtenä ("Naiset 5000 m kävely") tai useana ("Naiset 5000 m / 3000 m kävely"). Sukupuoliprefix ("Naiset"/"Miehet") luetaan `Gender`-kentästä.
- `ageClasses` säilyy nykyisellään (esim. `["N30","N35","N45","N50","N55","N60","N65","N70","N75","N80"]`), siitä tehdään alaotsikko.

### `src/routes/running-ops.tsx`
- Ryhmäkortin pääotsikko = yllä kuvattu yhdistetty nimi (eikä yhden roundin `EventName`).
- Alaotsikko: `"N30, N35, N45, N50, N55, N60, N65, N70, N75, N80 · 10 sarjaa · Loppukilpailu"`.
- Klikkaus välittää `group=`-parametrin URL:ssa kaikkien ryhmän roundien `eventId-roundId` -pareina (jo nyt näin).

### `src/routes/round.$eventId.$roundId.tsx`
Ei muutoksia logiikkaan — hakee ja yhdistää roundit `group`-paramin mukaisesti, ja näyttää jokaisella urheilijalla ikäluokkalapun (esim. `N65`). Tämä toimii myös sekamatka-tapauksessa: ratamerkinnät tehdään silti per heat-index, ja jos eri matkan jäsenillä on omat heatit, ne näkyvät erillisinä erinä — toimitsija näkee silti yhdellä sivulla kaikki samaan aikaan starttaavat.

### Pieni cosmetic-fix
`stripAgeFromEventName("N30 5000m kävely", "30")` jättää tällä hetkellä yksinäisen "N"-kirjaimen ("N 5000m kävely"). Lisätään parserin loppuun myös ikäluokkaprefix-poisto (regex `^[NMWTP]\s+`) jotta otsikko on siisti: "5000m kävely".

## Vahvistettavaa

Vahvistatko että haluat juuri tämän logiikan: **sama starttiaika + sama sukupuoli = sama ryhmä, vaikka matka olisi eri**? Tämä on toimitsijan kannalta järkevin, mutta jos haluat että matka pidetään ehdottomana erottimena, kerro — silloin teen vaihtoehtoisesti yhdistetyn otsikon vain saman matkan sisällä.
