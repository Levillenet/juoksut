## Ongelma

Kuuluttaja-linkki ei näy etusivulla käyttäjälle, jolla on `official`-rooli tietokannassa (esim. info@leville.net), koska `useAuth`-koukku antaa aina `role = "user"` kaikille kirjautuneille käyttäjille, riippumatta heidän DB-rooleistaan.

`src/lib/auth.tsx` rivi 111:
```ts
const role: Role = user ? "user" : effectiveOfficial ? "official" : null;
```

Näin `effectiveOfficial` (joka on true kun DB-rooli on `official` tai `admin`) huomioidaan vain kirjautumattomilla legacy-salasanakäyttäjillä. `showOfficialLinks = role === "official" || isAdmin` etusivulla on false, joten Kuuluttaja-linkki piilotetaan.

## Korjaus

Yksi muutos `src/lib/auth.tsx`:iin: priorisoi virallinen rooli myös kirjautuneelle käyttäjälle.

Rivi 111 muutetaan muotoon:
```ts
const role: Role = effectiveOfficial ? "official" : user ? "user" : null;
```

Tämä säilyttää nykyisen käyttäytymisen:
- Adminit saavat edelleen sekä `isAdmin=true` että `role="official"` (koska admin sisältyy `hasOfficialRole`-tarkistukseen), ja `RequireRole`-komponentti sallii admineille kaikki näkymät joka tapauksessa.
- Tavalliset kirjautuneet käyttäjät ilman `official`- tai `admin`-DB-roolia saavat edelleen `role="user"`.
- Legacy-salasanakäyttäjät (localStorage `official`-lippu) saavat edelleen `role="official"`.

Muutoksen vaikutuksesta:
- info@leville.net (DB-rooli `official`, ei admin): `showOfficialLinks` etusivulla true → Kuuluttaja-, Juoksulajien operointi- ja Aikataulun suunnittelija -linkit näkyvät.
- Kuuluttaja-, `/planner`- ja `/running-ops`-reittien `RequireRole allow={["official"]}` läpäisee.

## Ei muita muutoksia

`RequireRole`, `admin.roles.tsx` ja `announcer.tsx` pysyvät ennallaan. Kyseessä on yhden rivin korjaus roolin johtamislogiikassa.