## Ongelma

Admin-analytiikan "Käyttäjät"-taulussa "Viimeisin kirjautuminen" tulee `auth.users.last_sign_in_at`-sarakkeesta. Supabase päivittää sen vain uuden istunnon luonnin yhteydessä — token-refresh tai sivun avaus olemassa olevalla sessiolla ei kasvata sitä. Siksi "Uniikit käyttäjät tänään" (laskettu `analytics_events`-tapahtumista) voi näyttää 20, mutta `last_sign_in_at`-sarakkeen perusteella tänään on "kirjautunut" vain muutama.

## Ratkaisu

Näytetään taulussa oikea "Viimeksi nähty" -aika, joka lasketaan `analytics_events`-taulun `max(created_at)`-arvosta per `user_id` — silloin näkyvät kaikki tänään palvelussa käyneet käyttäjät.

## Muutokset

1. **Uusi RPC `list_auth_users_with_activity`** (migraatio):
   - Palauttaa `user_id, email, last_sign_in_at, last_seen_at` liittämällä `auth.users` ↔ `analytics_events` (max `created_at` per `user_id`).
   - `SECURITY DEFINER`, admin-tarkistus kuten nykyinen `list_auth_users`.
   - Järjestys: `last_seen_at DESC NULLS LAST`.

2. **`src/routes/admin.analytics.tsx`**:
   - `usersQ` kutsuu uutta RPC:tä.
   - Taulukkoon uusi sarake "Viimeksi nähty" (`last_seen_at`) ja "Viimeisin kirjautuminen" jää oheistiedoksi.
   - CSV-vientiin `last_seen_at` mukaan.
   - Oletusjärjestys `last_seen_at`-mukaan.

## Verifiointi

- Kutsu RPC:tä Supabasen kautta admin-sessiolla → tänään aktiivisten määrä ≈ "Uniikit käyttäjät tänään" -luku.
- Selaimessa admin/analytics-sivulla taulu näyttää nyt kaikki tänään käyneet käyttäjät.
