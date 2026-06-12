# Anna Matti Hannikaiselle pääsy kuuluttajanäkymään

## Tilanne

`/announcer` on suojattu `RequireRole allow={["official"]}`:lla. Tällä hetkellä vain officiali-salasanalla kirjautuneet (tai admin `samiaavikko@gmail.com`) pääsevät sisään. Henkilökohtaisesti kirjautuneet käyttäjät saavat roolin `"user"` eivätkä pääse läpi.

## Muutos

`src/components/RequireRole.tsx`: lisää sähköpostiperusteinen allowlist kuuluttajakäyttäjille — sama mekanismi kuin admin-poikkeus, mutta listana. Jos käyttäjän sähköposti löytyy listasta JA route sallii `"official"`-roolin, päästetään läpi.

```ts
const ANNOUNCER_ALLOWLIST = new Set<string>([
  "matti.hannikainen.84@gmail.com",
]);

const email = (user?.email ?? "").toLowerCase();
const isAdmin = email === "samiaavikko@gmail.com";
const isAnnouncerAllowed =
  ANNOUNCER_ALLOWLIST.has(email) && allow.includes("official");

if (!allow.includes(role) && !isAdmin && !isAnnouncerAllowed) {
  return <Navigate to="/" />;
}
```

Tämä antaa Matille pääsyn `/announcer`-aluettiin (joka käyttää `allow={["official"]}`). Muut suojatut näkymät, jotka eivät salli `"official"`-roolia, eivät vahingossa avaudu.

## Mitä ei muuteta

- Roolijärjestelmää (`Role`-tyyppi, `auth.tsx`) ei refaktoroida — pidetään muutos minimissä.
- Muita route-tiedostoja ei kosketa.
- Ei lisätä erillistä `user_roles`-taulua tähän — käytetty mekanismi on jo email-allowlist (admin-poikkeus), joten pysytään samassa kuviossa.

## Verifiointi

TypeScript-tarkistus. Matti kirjautuu Googlella → `/announcer` aukeaa.
