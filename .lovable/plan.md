# Korjaus: WhatsApp-esikatselu jaetulle urheilijakortille

## Ongelma
`src/routes/urheilija.$token.tsx`:n `head()` asettaa vain `title` ja `description` (name), mutta WhatsApp/Facebook/Twitter lukevat esikatselun **Open Graph** -tageista (`og:title`, `og:description`, `twitter:title`, `twitter:description`). Nämä periytyvät root-routelta (`src/routes/__root.tsx`), jossa lukee "Juoksulajien lähtöjärjestys" → siksi jaettu linkki näyttää väärän otsikon.

## Ratkaisu
Lisää `src/routes/urheilija.$token.tsx`:n `head()`-paluuseen seuraavat meta-tagit, jotka ylikirjoittavat rootin arvot juuri tällä reitillä:

- `og:title` = "Urheilijakortti"
- `og:description` = "Urheilijakohtaiset tulokset ja ennätykset"
- `og:type` = "profile"
- `twitter:title` = "Urheilijakortti"
- `twitter:description` = "Urheilijakohtaiset tulokset ja ennätykset"
- `twitter:card` = "summary"

Pidetään `noindex` ennallaan (jaettu yksityisempi linkki). Urheilijan nimeä ei voi laittaa otsikkoon staattisessa `head()`-funktiossa ilman loaderia — pidetään yleinen "Urheilijakortti" -teksti, joka vastaa käyttäjän toivetta.

## Mitä EI muuteta
- Itse sivun sisältö, jakologiikka, tietokanta — ennallaan.
- Muut reitit tai root-meta.
