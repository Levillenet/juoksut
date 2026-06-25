## Tavoite

Näytä admin-analytiikkasivulla (`/admin/analytics`) lista kaikista palvelun rekisteröityneistä käyttäjistä: sähköposti ja viimeisin kirjautuminen.

## Toteutus

Olemassa oleva RPC `list_auth_users()` palauttaa jo tarvittavat kentät (`user_id`, `email`, `last_sign_in_at`) ja on rajattu admin-käyttäjille. Käytetään sitä — ei uusia migraatioita.

**Muutos:** `src/routes/admin.analytics.tsx`

1. Lisää uusi `useQuery` joka kutsuu `supabase.rpc("list_auth_users")`.
2. Lisää uusi osio sivulle (esim. "Kaikki käyttäjät (N)") joka renderöi taulukon:
   - Sähköposti
   - Viimeisin kirjautuminen (suomenkielinen muotoilu, "ei koskaan" jos null)
3. Järjestys: viimeisin kirjautuminen laskevasti (RPC palauttaa jo näin).
4. Yksinkertainen hakukenttä sähköpostille (client-side filter), jotta isompi lista on käyttökelpoinen.
5. CSV-vientipainike samalla tyylillä kuin nykyiset Download-napit.

## Huomiot

- "Kaikki palvelussa käyneet" = `auth.users` (rekisteröityneet). Anonyymejä kävijöitä ei tallenneta käyttäjinä; `analytics_events`-taulussa on jo erikseen kävijätilastot.
- Ei muutoksia tietokantaan tai oikeuksiin.
