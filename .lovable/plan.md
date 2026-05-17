## Ongelma

Reitti `/settings/note-links` on olemassa ja "Muistiinpanojen jakaminen" -kortti renderöityy `/settings`-sivulla **kaikille kirjautuneille**, mutta tavallinen käyttäjä (rooli `"user"`, esim. `info@leville.net`) ei pääse `/settings`-sivulle lainkaan:

`src/routes/index.tsx` rivi 176:
```tsx
{showOfficialLinks && (
  <Link to="/settings" …>Asetukset</Link>
)}
```
ja rivi 66:
```ts
const showOfficialLinks = role === "official" || isAdmin;
```

Siksi kortti ja koko muistiinpanolinkitysominaisuus on käytännössä piilossa peruskäyttäjiltä. DB:ssä ei ole yhtään `note_link_invites`-riviä, mikä vahvistaa ettei kukaan ole päässyt edes lähettämään kutsua.

## Korjaus

Tehdään muistiinpanojen jakaminen löydettäväksi peruskäyttäjälle **ilman että avataan koko Asetukset-osio** (siellä on official/admin-tason sisältöä kuten Seurojen sijainnit, Tuloslista API -dokumentaatio).

### Muutos 1 — Lisää oma painike etusivulle peruskäyttäjille

`src/routes/index.tsx` (samaan painikeruudukkoon kuin "Tulostettava aikataulu"):

Lisää linkki, joka näkyy **aina kun käyttäjä on kirjautunut** (riippumatta roolista):

```tsx
<Link
  to="/settings/note-links"
  className="rounded-xl border-2 border-primary/30 bg-card px-4 py-2.5 text-center hover:bg-secondary"
>
  <div className="text-sm font-semibold leading-tight">Muistiinpanojen jakaminen</div>
  <div className="mt-0.5 text-[11px] text-muted-foreground">
    Linkitä tilisi toisen käyttäjän kanssa — näette muistiinpanot ristiin
  </div>
</Link>
```

Sijoitetaan ennen `showOfficialLinks`-gateattua Asetukset-painiketta, ilman gateä.

### Muutos 2 — Lisää "Takaisin"-linkki suoraan etusivulle myös /settings/note-links -sivulta

Jo nyt sivulla on otsikossa `ArrowLeft`-painike — tarkistetaan että se vie `/`-juureen (ei `/settings`), jotta peruskäyttäjä, joka tulee suoralinkillä, ei eksy Asetukset-sivulle, johon hänellä ei normaalisti ole pääsyä.

`src/routes/settings.note-links.tsx`: jos paluulinkki on tällä hetkellä `/settings`, vaihdetaan kohteeksi `/`.

### Mitä EI muuteta

- `/settings`-sivun pääsyä ei avata peruskäyttäjille — siellä on edelleen virkailija-/admin-sisältöä.
- Itse `/settings/note-links`-sivu on jo tarkoitettu kaikille kirjautuneille käyttäjille (RLS sallii kuka tahansa lähettää/vastaanottaa kutsuja), joten sen oma auth-gate riittää.
- Kortti `/settings`-sivulla pysyy ennallaan virkailijoita varten.

## Toteutusjärjestys

1. Lisää uusi painike `src/routes/index.tsx`-sivun toimintoruudukkoon (ennen Asetukset-painiketta, ei gateä).
2. Tarkista ja korjaa paluulinkki `src/routes/settings.note-links.tsx` → `/`.
