# Kilpailijaseurannan nimihaku laajennetaan koko tietokantaan

## Ongelma

`/watch`-sivun hakukenttä rajautuu nykyisin pelkästään käsillä olevan kilpailun osallistujiin ja vertailee vain sukunimeen. Käyttäjä haluaa lisätä seurantaan tuttuja myös muista seuroista, joten haun pitää löytää kaikki tietokannan urheilijat — etu- tai sukunimellä.

## Korjaus (vain `src/routes/watch.tsx`)

### 1. Haku osuu sekä etu- että sukunimeen
Nykyinen `searchGroups`-suodatus tarkistaa vain `Surname`. Laajenna se kattamaan myös `Firstname` (sama logiikka kuin `AthleteSearch`-komponentissa).

### 2. Lisää tietokantahaku
Uusi `useQuery`, joka triggeröityy kun haku on ≥ 2 merkkiä (300 ms debounce):

```ts
supabase
  .from("athlete_results")
  .select("athlete_key, surname, firstname, organization, organization_id")
  .or(`surname.ilike.%${q}%,firstname.ilike.%${q}%`)
  .limit(500);
```

Tulokset deduplikoidaan `athlete_key`:n perusteella. Kullekin urheilijalle valitaan tuorein `organization` näkyviin.

### 3. Yhdistetty tuloslista
Yksi "Hakutulokset"-osio, joka sisältää:
- **Ensin** tämän kilpailun osumat (säilyttävät nykyisen "X lajia" -badgen)
- **Sen jälkeen** muut tietokannan osumat (badge "muista kisoista" tai pelkkä seuran nimi)
- Dedupe `athlete_key`-tasolla: jos sama urheilija on jo kilpailun listalla, älä toista häntä alaosiossa.

Kummassakin tapauksessa rivillä on sama "Seuraa / Seurannassa" -painike kuin nyt.

### 4. UX-yksityiskohdat
- Placeholder: "Hae nimellä (etu- tai sukunimi)"
- Latausindikaattori jos tietokantahaku on kesken
- Maks. esim. 50 nimeä näkyviin, jos enemmän → "Jatka kirjoittamista tarkentaaksesi"

## Pois rajauksesta

- "Lisää seuran urheilijat seurantaan" -osio jätetään nykyiseksi (se on sidottu käsillä olevaan kisaan tarkoituksella).
- Frontend-only muutos, ei tietokantamuutoksia.

## Tiedostot

- `src/routes/watch.tsx` — haun logiikka ja `Hakutulokset`-osion rendaus
