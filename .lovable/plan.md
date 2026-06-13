## Ongelma

"Seuran urheilijat tänään" -listassa Lahden Ahkeran urheilijoiden (esim. Front Lauri, 60m 10,23) uusia PB-ennätyksiä ei merkitä PB-merkillä, vaikka Jyväskylän Kenttäurheilijoiden vastaavat näkyvät oikein.

## Juurisyy

`src/lib/club-today.ts` → `fetchClubPbs` rajaa "aiemmat PB:t" SQL-ehdolla:

```ts
if (beforeISO) query = query.lt("competition_date", beforeISO);
```

Monipäiväisissä kisoissa (YAG 12.–14.6.) jokaisen päivän tuloksilla on sama `competition_date` = kisan alkamispäivä (12.6.). Kun valittu päivä on 13.6., `beforeISO` = 13.6. 00:00 → ehto `12.6. < 13.6.` täyttyy myös **tänään juostuille tuloksille**. Niinpä Front Laurin tämänpäiväinen 10,23 luetaan "aiempana PB:nä" → vertailu ei näe parannusta → PB-rusettia ei piirretä.

Yksipäiväisissä kisoissa ongelmaa ei näy, koska `competition_date` = sama kuin tämä päivä → ei mukana "aiemmissa".

## Korjaus

Yksi muutos `src/lib/club-today.ts`:ssa.

`fetchClubPbs` ottaa `beforeISO`:n sijaan/lisäksi rajauksen `captured_at`-kenttään, koska se kuvaa todellista tallennushetkeä eikä kisan alkamispäivää:

```ts
if (beforeISO) query = query.lt("captured_at", beforeISO);
```

`fetchClubPreviousPbs` antaa edelleen `helsinkiDayBounds(beforeDate).startISO` ⇒ tämän päivän 00:00 Helsinki-aikaa. Tällöin:

- Eilen tai aiemmin tallennetut YAG-tulokset → mukana (oikein, oikea PB-vertailupohja).
- Tänään tallennetut YAG-tulokset (sis. saman päivän aiemmat erät) → EIVÄT mukana → tämän päivän paras 10,23 verrataan kunnolla edelliseen ennätykseen → PB-merkki ilmestyy.

Sama tarkennus pidetään johdonmukaisena aiemman korjauksen kanssa, jossa `daily-best.ts`/`club-today.ts` luvut siirrettiin jo käyttämään `captured_at`a monipäiväisten kisojen tukemiseksi.

## Vaikutus

- Front Laurin ja muiden Lahden Ahkeran YAG-urheilijoiden uudet PB:t näkyvät PB-merkillä ja parannuslukemalla.
- Yksipäiväisissä kisoissa käytös pysyy samana (`captured_at` ja `competition_date` osuvat samalle päivälle).
- Ei muutoksia UI-koodiin, kyselyavaimiin tai muihin osioihin.
