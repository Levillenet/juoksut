## Ongelma

`/settings`-sivu on tällä hetkellä virkailija-/admin-lukittu (`showOfficialLinks` etusivulla), ja sivun sisällä kaikki osiot näkyvät rooliin katsomatta. Peruskäyttäjä ei pääse perille → ei voi muokata seuransa sijaintia eikä päivitystiheyttä. Lisäksi oletuspäivitystiheys on 30 s ja muutamia sisältöjä halutaan piilottaa peruskäyttäjältä, koska ominaisuus ei ole vielä julkaistu.

## Muutokset

### 1) Avaa `/settings` peruskäyttäjälle

`src/routes/index.tsx` (rivi ~176): poista `showOfficialLinks`-gate "Asetukset"-painikkeesta, näytä se kaikille kirjautuneille (`role` truthy). Painikkeen alateksti voidaan päivittää neutraaliksi:
- "Päivitystiheys ja oman seurasi sijainti"

### 2) Roolikohtainen sisältö `/settings`-sivulla

`src/routes/settings.tsx`: jaa osiot kahteen ryhmään.

**Näkyvät kaikille kirjautuneille:**
- Päivitystiheys
- Seurojen sijainnit

**Näkyvät vain virkailijoille/adminille (`role === "official"` || `isAdmin`):**
- Tiimit ja jaetut muistiinpanot
- Muistiinpanojen jakaminen (1-1)
- Tuloslista API – saatavilla oleva data
- Kehitysideoita

Toteutus: lue `useAuth()`:n `role` ja kääri virkailija-osiot `{showOfficialSections && (…)}`-lohkoon. Auth-loading suojaus on jo `SettingsGate`:ssa, joten välähdys-riskiä ei tule.

### 3) Oletuspäivitystiheys 15 s

`src/lib/settings-store.ts`: `DEFAULT_REFRESH_SEC = 30` → **`15`**. Käyttäjän oma localStorage-valinta säilyy.

### 4) Korjaa "Hallinnoi linkityksiä" -painike

Painike (`src/routes/settings.tsx` rivit 87–93) on tällä hetkellä `<Link to="/settings/note-links">` — reitti on rekisteröity, joten linkki *pitäisi* navigoida. Tämän muutoksen yhteydessä osio piilotetaan peruskäyttäjältä, mutta virkailijalle se jää näkyviin → varmistetaan että nappi toimii:
- Tarkistetaan että `Link` ei ole `<button>`-kääreen sisällä (ei ole — sisempi rakenne on suora `<Link>` `inline-flex`-classella, joten OK).
- Jos navigointi ei silti virkistäydy, vaihdetaan tilalle `Button asChild` + `Link`:
  ```tsx
  <Button asChild variant="outline" size="sm">
    <Link to="/settings/note-links">
      <Link2 className="h-4 w-4" />
      Hallinnoi linkityksiä
    </Link>
  </Button>
  ```
- Verifioidaan toiminta lopuksi previewissä virkailija-roolilla.

### 5) Pidetään etusivun "Muistiinpanojen jakaminen" -painike

Aiemmin lisätty etusivun painike (kirjautuneille) säilyy — peruskäyttäjä pääsee silti linkitysominaisuuteen suoraan etusivulta, vaikka asetussivulla osiota ei näy.

## Toteutusjärjestys

1. `src/lib/settings-store.ts`: oletus 15 s.
2. `src/routes/index.tsx`: avaa "Asetukset"-painike kaikille kirjautuneille + päivitä alateksti.
3. `src/routes/settings.tsx`: lue rooli, kääri virkailija-osiot `showOfficialSections`-gateen, vahvista "Hallinnoi linkityksiä" -linkin toiminta (tarvittaessa `Button asChild`).
4. Verifioi previewissä peruskäyttäjänä ja virkailijana.
