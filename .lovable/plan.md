## Nykytila

- `admin` ja `planner` ovat oikeita tietokantarooleja (`public.user_roles` + `app_role`-enum), joita hallitaan sivulla `/admin/roles`.
- **Toimitsija ("official") EI ole tietokannassa** — se on pelkkä selaimen `localStorage`-lippu, jonka saa syöttämällä yhteisen salasanan `ahkera2026` (`src/lib/auth.tsx`, `OFFICIAL_PASSWORD`). Sama salasana kaikille, ei per-käyttäjä-myöntöä, ei peruutusta.

Siksi et voi tällä hetkellä myöntää toimitsijaoikeuksia yksittäiselle käyttäjälle samasta paikasta kuin plannerin/adminin.

## Suunnitelma

Tehdään toimitsijasta oikea tietokantarooli plannerin tapaan, ja jätetään vanha salasana toistaiseksi rinnalle taaksepäin yhteensopivuuden vuoksi (poistetaan halutessasi myöhemmin).

1. **Migraatio** — lisää `official` `app_role`-enumiin:
   ```sql
   ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'official';
   ```

2. **`src/routes/admin.roles.tsx`**
   - Laajenna rooli-tyyppi ja UI-dropdown arvoihin `planner | admin | official`.
   - `grant_role_by_email` ja `revoke_role` toimivat sellaisenaan, koska ne ottavat `app_role`-parametrin.
   - Näytä toimitsijat listassa muiden roolien seassa.

3. **`src/lib/auth.tsx`**
   - `isOfficial` = `localStorage`-lippu **TAI** `roles.includes("official")`.
   - Näin salasanalla kirjautuneet toimitsijat toimivat entiseen tapaan, mutta admin voi myös myöntää oikeuden suoraan sähköpostilla ilman että käyttäjän tarvitsee tietää yhteistä salasanaa.

4. **Verifiointi**
   - Aja migraatio, tarkista että `/admin/roles` näyttää uuden vaihtoehdon.
   - Myönnä testikäyttäjälle "official"-rooli sähköpostilla, kirjaudu tuolla käyttäjällä, tarkista että etusivulla näkyy toimitsijan valikot (Kuuluttaja, Juoksulajien operointi) ilman salasanan syöttöä.
   - Poista rooli, tarkista että valikot katoavat.

## Ei muutosta tässä

- Salasanaa `ahkera2026` ei poisteta. Jos haluat, poistan sen erillisenä pyyntönä sen jälkeen kun kaikki nykyiset toimitsijat on siirretty rooliin.
- Reittien pääsyoikeussääntöjä (`RequireRole`, `/running-ops` jne.) ei muuteta, koska ne katsovat jo `isOfficial`-lippua joka päivittyy automaattisesti.
