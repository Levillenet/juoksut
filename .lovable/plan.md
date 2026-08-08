# Korjaus: toimitsijaprofiilin tallennus ei mene läpi

## Mitä tapahtuu nyt

Toimitsijaprofiilin tallennus epäonnistuu aina, joten profiilia ei ole olemassa tietokannassa. Siksi urheilijoiden kiinnitys sanoo edelleen "Tallenna ensin profiili". Tarkistin tietokannan: toimitsijaprofiilien taulu on täysin tyhjä, eli yhtään profiilia ei ole koskaan tallentunut.

Syy: profiilin tallennus tehdään "upsert"-operaatiolla, joka nojaa käyttäjätunnuksen yksilöivään indeksiin. Tietokannassa tuo indeksi on ehdollinen (koskee vain rivejä, joilla on käyttäjätunnus, koska järjestäjä voi luoda myös käsin lisättyjä toimitsijakortteja ilman tunnusta). Postgres ei hyväksy ehdollista indeksiä tällaisen upsertin perustaksi, joten kutsu kaatuu virheeseen eikä mitään tallennu.

## Korjaus

1. Muutetaan profiilin tallennus kaksivaiheiseksi kirjastossa `src/lib/officials.ts`:
   - haetaan ensin oma profiili käyttäjätunnuksella
   - jos löytyy, päivitetään olemassa oleva rivi
   - jos ei löydy, luodaan uusi rivi
   - palautetaan tallennettu profiili kuten ennenkin, jotta käyttöliittymä saa heti profiilin ja urheilijoiden kiinnitys avautuu
2. Virheenkäsittely: jos tallennus epäonnistuu, näytetään tietokannan antama virheteksti selkeästi, jottei epäonnistunut tallennus näytä onnistuneelta.
3. Tarkistetaan samalla, ettei muualla käytetä samaa ehdolliseen indeksiin nojaavaa upsert-tapaa (`official_profiles`-taulua käyttää vain `src/lib/officials.ts`).

## Testaus

- Tallenna toimitsijaprofiili (nimi, sähköposti, seura).
- Varmista, että "Tallenna ensin profiili" -huomautus katoaa ja urheilijan haku ja kiinnitys toimivat.
- Tallenna profiili uudestaan muutetuilla tiedoilla ja varmista, ettei synny kaksoisriviä.

## Tekniset yksityiskohdat

- Taulu `public.official_profiles`, indeksi `official_profiles_user_id_uidx` on osittainen: `WHERE user_id IS NOT NULL`.
- Nykyinen kutsu `.upsert({...}, { onConflict: "user_id" })` tuottaa Postgres-virheen 42P10 (ei vastaavaa yksilöivää rajoitetta).
- Korjaus tehdään sovelluskoodissa, ei tietokannan skeemaan, jotta käsin luodut toimitsijakortit ilman käyttäjätunnusta toimivat jatkossakin.
