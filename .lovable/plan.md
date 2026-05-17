## Ongelma

Edellisellä kierroksella `Muistiinpanojen jakaminen` -osio käärittiin `showOfficialSections`-gateen yhdessä `Tiimit`-osion kanssa, joten peruskäyttäjä ei näe sitä enää /settings-sivulla. Etusivulla oleva kortti toimii, mutta käyttäjä odottaa löytävänsä toiminnon myös asetuksista.

## Korjaus

`src/routes/settings.tsx`: nosta `Muistiinpanojen jakaminen` -osio gaten ulkopuolelle (kaikkien kirjautuneiden näkyvissä), pidä `Tiimit ja jaetut muistiinpanot` edelleen vain virkailijoille.

Lopullinen järjestys peruskäyttäjälle:
1. Päivitystiheys
2. Muistiinpanojen jakaminen ("Hallinnoi linkityksiä" → /settings/note-links)
3. Seurojen sijainnit

Virkailijalle/adminille lisäksi:
4. Tiimit ja jaetut muistiinpanot
5. Tuloslista API
6. Kehitysideoita

Ei muita muutoksia.
