## Tavoite

- Lisätä käyttäjäkohtainen `planner`-rooli, jonka adminisi voi myöntää.
- Näyttää pääsivulla "Aikataulusuunnittelu" -kortti vain planner-roolin (ja adminin) saaneille.
- Tehdä stadion-kirjastosta yhteinen kaikille planner-rooli­laisille (kaikki näkevät ja muokkaavat).
- Pitää kilpailusuunnitelmat (`competition_plans` + niiden lapsitaulut) edelleen omistajakohtaisina — jokainen suunnittelija näkee vain omat kisansa.

## Tietokantamuutokset (migraatio)

1. **Roolit**
   - `CREATE TYPE public.app_role AS ENUM ('admin','planner');`
   - `CREATE TABLE public.user_roles(id, user_id → auth.users, role app_role, UNIQUE(user_id,role))` + GRANTit (`authenticated SELECT`, `service_role ALL`) + RLS päälle.
   - `has_role(_user_id uuid, _role app_role)` SECURITY DEFINER -funktio.
   - RLS-politiikat:
     - planner/admin näkee oman rivinsä.
     - admin voi insert/update/delete kaikkia rooleja.
   - Seedaa: insertoi `admin`-rivi sinun käyttäjällesi (haetaan auth.users:sta `samiaavikko@gmail.com`).

2. **Stadionit jaettu planner-roolille**
   - `stadiums`: poistetaan vanha omistajapolitiikka, lisätään:
     - SELECT/INSERT/UPDATE/DELETE: `has_role(auth.uid(),'planner') OR has_role(auth.uid(),'admin')`.
   - `stadium_venues` ja `stadium_conflict_groups`: vastaava — planner/admin saa kaikki rivit.
   - Säilytetään `user_id` stadionissa (audit-mielessä).

3. **Kilpailusuunnitelmat pysyvät yksityisinä**
   - Ei muutoksia `competition_plans`-, `plan_*`-tauluille — omistajapolitiikka säilyy.

## Frontend-muutokset

1. **`src/lib/auth.tsx`**
   - Hae kirjautumisen jälkeen käyttäjän roolit `user_roles`-taulusta.
   - Lisää contextiin: `isPlanner: boolean`, `isAdmin: boolean` (DB-pohjainen, korvaa nykyisen sähköpostipohjaisen admin-tarkistuksen).
   - Säilytetään olemassa oleva `role` ("user"/"official") siirtymäaikana, koska sitä käytetään muualla.

2. **`src/routes/index.tsx` (pääsivu)**
   - Lisää uusi kortti "Aikataulusuunnittelu" → linkki `/planner` (jos `isPlanner || isAdmin`).
   - Käytetään uutta `isAdmin`-arvoa contextista sähköpostivertailun sijaan.

3. **Admin-näkymä rooleille** — uusi sivu `src/routes/admin.roles.tsx`
   - Lista nykyisistä planner/admin-käyttäjistä (näytetään email).
   - Lomake sähköpostilla planner-roolin myöntämiseen.
   - Linkki pääsivun admin-osiosta.

4. **`/planner`- ja `/stadiums`-reittien suoja**
   - Lisätään komponenttiin tarkistus: jos ei plannería/adminia → näytetään "Ei oikeuksia" -viesti tai redirect `/`.

## Tekninen huomio

- Roolitarkistus tehdään aina `has_role()`-funktiolla RLS-politiikoissa (välttää rekursion `user_roles`-taulun omilla politiikoilla).
- Adminin myöntämä rooli vaatii palvelinpuolen kutsun? Ei — RLS sallii adminin INSERTin `user_roles`:iin suoraan clientistä (politiikka `has_role(auth.uid(),'admin')`).
- Sähköposti haetaan `auth.users`:sta `has_role`-tyylisellä `get_user_id_by_email(email)` SECURITY DEFINER -funktiolla, koska `auth.users` ei ole suoraan luettavissa clientille.
