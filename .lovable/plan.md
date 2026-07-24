## Oire

Käyttäjä yrittää kirjautua osoitteessa `https://tulokset.online` Google-tilillä. Selain ohjautuu `oauth.lovable.app/callback` -osoitteeseen, joka näyttää "Authorization failed — State verification failed — Error code: invalid_request".

Auth-lokeissa näkyy silti onnistunut Google-login (`samiaavikko@gmail.com`, 16:59:30) sekä useita `refresh_token_not_found` -virheitä. Ensimmäinen URL sisältää täyden `#access_token=...` -hashin `tulokset.online`-domainissa, mikä viittaa siihen että alkuperäinen kirjautuminen onnistui, mutta perässä tullut toinen OAuth-kierros (`prompt=none`, hiljainen istunnon uusinta) epäonnistuu state-tarkistuksessa.

## Todennäköinen syy (vahvistettava)

- `redirect_uri` on `window.location.origin` eli `https://tulokset.online`, mutta Lovablen hallitseman OAuth-brokerin (`oauth.lovable.app`) state-eväste on asetettu eri originille kuin mistä callback luetaan. Kun useita välilehtiä / silent-refreshejä on käynnissä, state-arvot menevät ristiin ja callback hylkää pyynnön.
- Toisin sanoen: käytännössä ongelma tulee Lovablen managed OAuth -infrastruktuurin ja custom-domainin (`tulokset.online`) yhteispelistä, ei sovelluskoodin oletusarvoista.

Tämä on suunnitelma joka nimenomaan selvittää sen ennen koodin muutoksia.

## Suunnitelma

1. **Tarkasta OAuth-konfiguraatio** työkalulla `supabase--debug_oauth_server` ja varmista että:
   - Site URL / sallitut redirect URL:t sisältävät sekä `https://tulokset.online`, `https://www.tulokset.online`, että `https://juoksut.lovable.app`.
   - Managed Google-provider on aktivoitu (`supabase--configure_social_auth`, providers: `["google"]`) ilman uusia providereita.

2. **Selvitä eroaako login-lähtöpaikka**: pyydä käyttäjää testaamaan kirjautuminen inkognito-ikkunassa suoraan `https://tulokset.online/login` -osoitteesta ja katso konsoli-/verkkoloki. Jos onnistuu, vika on vanhoissa evästeissä; jos ei, vika on redirect-allow-listassa tai brokerin state-cookiessa.

3. **Muutokset koodiin (vasta jos yllä vahvistuu tarve):**
   - `src/routes/login.tsx`: käytä `redirect_uri`-arvona vakioitua callback-polkua (`${window.location.origin}/`) ja varmista että se on juuri se URL joka on lisätty allow-listalle.
   - Tarvittaessa lisää lyhyt info kirjautumissivulle: jos "State verification failed" toistuu, tyhjennä `oauth.lovable.app` -evästeet ja yritä uudelleen.

4. **Verifiointi:**
   - Aja `supabase--debug_oauth_server` uudelleen.
   - Pyydä käyttäjää kokeilemaan sekä `tulokset.online`, `www.tulokset.online` että `juoksut.lovable.app` -osoitteista.

## Odotettu lopputulos

Google-kirjautuminen tuotanto-domainista `tulokset.online` toimii ilman "State verification failed" -virhettä, ja hiljaiset istunnon uusinnat eivät enää heitä `invalid_request`-virhettä callback-sivulle.
