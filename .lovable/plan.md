## Ongelma

WhatsAppin linkkiesikatselu (`/seuraa/<token>`) näyttää nyt:
- otsikkona: "Juoksulajien lähtöjärjestys"
- kuvana: vanhan kilpailun lähtölista-screenshot
- kuvauksena: "Race Day Assist provides a streamlined UI for race organizers…"

Syy: `src/routes/__root.tsx` asettaa nuo `og:`/`twitter:` -tagit koko sovellukselle, ja `seuraa.$token.tsx` ylikirjoittaa vain `title`+`description`, ei `og:title`, `og:description` eikä `og:image`. WhatsApp/Telegram/iMessage lukevat nimenomaan `og:`-tageja.

## Korjaus

1. **Tee Ahkeran logosta julkisesti haettava URL.**
   `src/assets/lahden-ahkera-logo.png` on bundlattu Vite-asset, ja sen hash-URL:lla varustettu polku ei ole vakaa eikä toimi luotettavasti sosiaalisten crawlereiden kanssa. Lataan logon julkiseen Cloud-storage-bucketiin (`public-assets`) `supabase--storage_upload` -työkalulla → saadaan pysyvä `https://…/public-assets/lahden-ahkera-logo.png`.

2. **Päivitä `src/routes/seuraa.$token.tsx` `head()`** asettamaan kaikki suosittelutagit jakonäkymälle:
   - `title`: `"Seuraa kilpailupäivän etenemistä"`
   - `description`: `"Reaaliaikainen kilpailijaseuranta — näe miten päivä etenee."`
   - `og:title`, `og:description`, `twitter:title`, `twitter:description`: samat
   - `og:image`, `twitter:image`: ladatun logon absoluuttinen URL
   - `og:type`: `website`
   - `twitter:card`: `summary` (neliökuvalle sopiva, ei iso bannerimuoto)
   - säilytetään `robots: noindex`

   Lapsireitin `meta`-tagit ylikirjoittavat juuren tagit samalla `name`/`property`-arvolla, joten väärä lähtölistakuva ja "Juoksulajien lähtöjärjestys" -teksti katoavat tästä näkymästä.

3. **Ei muutoksia muihin reitteihin.** Etusivun ja muiden reittien WhatsApp-esikatselu pysyy ennallaan.

## Tekniset huomiot

- WhatsApp välimuistittaa OG-tiedot URL:n perusteella aggressiivisesti. Jo jaetut linkit voivat näkyä vanhalla kuvalla kunnes WhatsApp päivittää välimuistinsa (yleensä joitain päiviä, tai uutta tokenia jakamalla).
- Logokuvaa ei tarvitse skaalata: ~512×512 PNG riittää `summary`-kortille.
- Vältetään suhteellisia `og:image` -polkuja — käytetään aina absoluuttista httpsURL:ää.

## Muutettavat tiedostot

- `src/routes/seuraa.$token.tsx` — laajennetaan `head()` täydellä OG/Twitter-setillä
- (storage upload, ei tiedostomuutosta repossa)
