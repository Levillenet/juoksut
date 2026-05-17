## Tavoite

Kevyt **muistiinpanojen jakaminen sähköpostilla**, erillisenä tiimi-ominaisuudesta. Linkitys on **kaksisuuntainen**: kun A linkittää tilinsä B:n kanssa ja B hyväksyy, molemmat näkevät toistensa muistiinpanot. Linkityksen voi tehdä usean käyttäjän kanssa.

Lopputilanne: kaksi rinnakkaista jakotapaa
1. **Tilien linkitys** (uusi, yksinkertainen) — pari- tai monikäyttäjälinkki ilman tiimirakennetta.
2. **Teams** (jo toteutettu) — säilyy ennallaan tulevia treeniryhmiä varten.

Molemmat vaikuttavat `athlete_notes` SELECT-policyyn additiivisesti.

---

## Osa A — Tietokanta

**`note_links`** — voimassaolevat linkitykset (kaksisuuntainen pari)
- `id`, `user_a_id`, `user_b_id`, `created_at`
- CHECK `user_a_id < user_b_id` (normalisoitu järjestys, estää duplikaatit)
- UNIQUE (user_a_id, user_b_id)
- RLS SELECT: `auth.uid() IN (user_a_id, user_b_id)`
- RLS DELETE: kumpi tahansa osapuoli voi purkaa
- INSERT vain server-funktion kautta (admin client kutsun hyväksynnässä)

**`note_link_invites`** — pending-kutsut
- `id`, `inviter_user_id`, `email` (lowercase), `status` ('pending'|'accepted'|'declined'|'revoked'), `created_at`, `responded_at`
- UNIQUE (inviter_user_id, email) WHERE status='pending'
- RLS SELECT: `auth.uid()=inviter_user_id` TAI `lower(email)=auth.jwt()->>email`
- RLS INSERT: vain inviter itse
- RLS UPDATE: inviter (revoke) tai vastaanottaja (accept/decline)

Päivitettävä security definer -funktio (laajentaa nykyistä):

```sql
CREATE OR REPLACE FUNCTION public.shared_note_owner_ids(_user uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _user
  UNION
  SELECT user_id FROM public.shared_team_user_ids(_user) AS user_id
  UNION
  SELECT CASE WHEN user_a_id = _user THEN user_b_id ELSE user_a_id END
  FROM public.note_links
  WHERE _user IN (user_a_id, user_b_id);
$$;
```

`athlete_notes` SELECT-policy päivitetään käyttämään `shared_note_owner_ids(auth.uid())`. INSERT/UPDATE/DELETE pysyvät owner-rajoitettuina.

---

## Osa B — Server functions (`src/lib/note-links.functions.ts`)

- `inviteNoteLink({ email })` — luo kutsun. Estää itse-kutsun ja duplikaatin (jos `note_links` jo olemassa kyseiselle parille).
- `respondNoteLinkInvite({ inviteId, accept })` — vastaanottaja vastaa. Hyväksyttäessä luodaan `note_links` rivi normalisoidulla user_a/user_b järjestyksellä admin-clientillä.
- `revokeNoteLinkInvite({ inviteId })` — inviter peruu pendingin.
- `removeNoteLink({ linkId })` — kumpi tahansa osapuoli purkaa aktiivisen linkin.
- `listMyNoteLinks()` — palauttaa aktiiviset linkit (toisen osapuolen nimi+sähköposti), saapuneet pendingit, lähetetyt pendingit.
- Laajenna olemassa olevaa `getTeammateLabels`:ä (tai luo `getNoteOwnerLabels`) niin että palauttaa nimet sekä tiimi- että linkityskumppaneille.

---

## Osa C — UI

**Uusi sivu `/settings/note-links`**:
- "Linkitä tili toisen käyttäjän kanssa" — sähköpostikenttä + lähetä-nappi
- "Saapuneet pyynnöt" — hyväksy / hylkää
- "Lähetetyt pyynnöt" (pending) — peruuta
- "Aktiiviset linkitykset" — kumppanin nimi/sähköposti + purku-nappi
- Lyhyt selite: "Linkityksen jälkeen näette toistenne muistiinpanot urheilijasivuilla. Omistaja näkyy aina muistiinpanon yhteydessä."

**`/settings`-sivu**: lisätään "Muistiinpanojen jakaminen" -kortti omana erillisenä korttina ennen "Tiimit"-korttia. Selite: "Yksinkertainen 1-1-jako ilman tiimiä."

**Athlete-sivu (`athlete.$key.tsx`)**:
- RLS hoitaa näkyvyyden automaattisesti.
- `getTeammateLabels` → `getNoteOwnerLabels` (kattaa sekä tiimit että linkit).
- Muistiinpanon yhteydessä näkyy omistajan nimi muiden kuin omien kohdalla; vain oma muokattavissa.
- "Näytä kaikki muistiinpanot" -listaan lisätään omistajamerkintä muiden muistiinpanoihin.

---

## Toteutusjärjestys

1. Migraatio: `note_links`, `note_link_invites`, päivitetty `shared_note_owner_ids` + päivitetty `athlete_notes` SELECT-policy.
2. `src/lib/note-links.functions.ts`.
3. `src/routes/settings.note-links.tsx`.
4. `/settings` lisäkortti.
5. Athlete-sivun owner-label-haku laajennetaan.

---

## Tekniset huomiot

- Sähköpostit aina `lower(trim(...))`, sama logiikka kuin `team_invites`.
- Vastaanottajan user_id selvitetään admin-clientillä `auth.users`-taulusta hyväksynnän yhteydessä (sama pattern kuin `acceptTeamInvite`).
- Normalisoitu `user_a_id < user_b_id` -järjestys estää saman parin duplikaatit ja yksinkertaistaa UNIQUE-rajoitteen.
- Tiimi- ja linkitysreitit ovat additiivisia — ei päällekkäisyysongelmia, koska SET UNION dedupaa.

Vahvistatko niin teen migraation ensin?
