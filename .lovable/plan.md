## Suunnitelma: Kuuluttajanäkymän avaaminen kaikille käyttäjille

### Tausta
Kuuluttajanäkymä ( `/announcer/*` ) on tällä hetkellä suojattu `RequireRole`-komponentilla, joka vaatii `official`-roolin. Tämä tarkoittaa, että käyttäjän täytyy joko:
- Kirjautua virallisella salasanalla (localStorage-based)
- Olla allowlistatulla sähköpostilla ja kirjautuneena
- Olla admin (samiaavikko@gmail.com)

### Tavoite
Poistaa roolivaatimus, jotta kaikki käyttäjät (kirjautuneet ja ei-kirjautuneet) voivat nähdä ja käyttää kuuluttajanäkymää.

### Tekninen toteutus

**Muokattava tiedosto:** `src/routes/announcer.tsx`

**Muutokset:**
- Poista `RequireRole`-komponentin import ja käyttö
- Korvaa komponentti palauttamalla suoraan `<Outlet />`
- Säilytä `head()`-metatiedot ennallaan

```tsx
// Nykyinen:
component: () => (
  <RequireRole allow={["official"]}>
    <Outlet />
  </RequireRole>
),

// Uusi:
component: () => <Outlet />,
```

### Vaikutukset
- `/announcer`, `/announcer/combined`, `/announcer/live`, `/announcer/planning` -reitit ovat julkisesti saatavilla
- Näkymän asetukset tallentuvat edelleen localStorageen; kirjautuneet käyttäjät voivat synkronoida asetukset tililleen
- Kaikki data tulee julkisesta tuloslista-API:sta, joten ei vaadi autentikaatiota

### Riskit
- Ei merkittäviä riskejä; kuuluttajanäkymä on puhtaasti lukunäkymä tuloslistadatasta
- Ainoastaan asetus-tallennus (layout) edellyttää kirjautumista jos haluaa synkronoinnin, mutta localStorage-varmuuskopio toimii aina