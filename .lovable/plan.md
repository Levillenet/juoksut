## 1. Nimihaun korjaus ("Aapo Simo" ei löydy)

**Ongelma:** `src/components/AthleteSearch.tsx` tarkistaa, sisältyykö koko hakumerkkijono joko sukunimeen tai etunimeen. "aapo simo" ei sisälly kumpaankaan erikseen → ei osumia.

**Korjaus:** Tokenisoi haku välilyönneillä. Jokainen sana täytyy löytyä joko sukunimestä, etunimestä tai yhdistelmästä `"{surname} {firstname}"` / `"{firstname} {surname}"` (substring, case-insensitive).

```ts
const tokens = q.split(/\s+/).filter(Boolean);
const matches = index.filter((e) => {
  const s = (e.alloc.Surname ?? "").toLowerCase();
  const f = (e.alloc.Firstname ?? "").toLowerCase();
  const full = `${s} ${f} ${f} ${s}`;
  return tokens.every((t) => full.includes(t));
});
```

Toimii sekä "Aapo", "Simo", "Aapo Simo" että "Simo Aapo".

## 2. Urheilijakortin julkinen jakolinkki

### Tavoite
Käyttäjä voi luoda julkisen linkin urheilijan tilastokorttiin. Vastaanottaja näkee samat tulokset/ennätykset kuin `/athlete/$key`, mutta:
- ei vaadi kirjautumista,
- ei back-painiketta eikä muita linkkejä eteenpäin (vain profiili),
- header-tekstinä esim. "Jaettu urheilijakortti".

### Tietokanta (uusi migraatio)

Uusi taulu `athlete_shares`:
- `token text primary key`
- `user_id uuid not null` (jakaja)
- `athlete_key text not null`
- `surname text`, `firstname text`, `organization text`, `organization_id int` (cache näyttöä varten)
- `created_at timestamptz default now()`
- `revoked_at timestamptz`

RLS:
- Owner SELECT/INSERT/UPDATE/DELETE omille (auth.uid = user_id).
- Ei julkista SELECTiä — julkinen luku tehdään SECURITY DEFINER -funktiolla.

SECURITY DEFINER -funktio `get_shared_athlete(p_token text)`:
- Palauttaa `athlete_key, surname, firstname, organization, organization_id, revoked` jos token löytyy.

Julkinen luku tuloksiin: `athlete_results` vaatii nykyisin `authenticated`. Lisätään toinen SECURITY DEFINER -funktio `get_shared_athlete_results(p_token text)` joka palauttaa kyseisen `athlete_key`:n rivit `athlete_results`-taulusta vain jos voimassa oleva token löytyy. Näin RLS pysyy kireänä mutta jaettu kortti toimii kirjautumattomalle.

### Backend-apuri `src/lib/athlete-share.ts`

Vastaava kuin `watch-share.ts`:
- `useAthleteShare(athleteKey, surname, firstname, organization, organizationId)` — hae/luo/peruuta jakolinkki.
- `loadSharedAthlete(token)` — kutsuu kahta RPC:tä ja palauttaa profiilin + tulokset.

### UI-muutokset

**`src/routes/athlete.$key.tsx`** — headeriin "Jaa"-painike (Share2-ikoni). Avaa pienen dialogin/popoverin, jossa:
- Pieni ohjeteksti: *"Jaa tästä urheilijakohtaiset tilastot linkkinä."*
- "Luo linkki" -nappi → näyttää URL:n + Kopioi-napin.
- "Peruuta jako" -nappi olemassa olevalle linkille.

**Uusi reitti `src/routes/urheilija.$token.tsx`** (julkinen, EI `_authenticated/`):
- `RequireRole`-wrapperia EI käytetä.
- Headerissa vain otsikko "Jaettu urheilijakortti" + jakajan nimi (owner_label voidaan lisätä halutessa myöhemmin) — ei back-nappia, ei navigointia.
- Renderöi saman `EventGroupView`-pohjaisen tilaston kuin `/athlete/$key`, mutta ilman muistiinpano-osiota ja ilman linkkejä eteenpäin.
- Jos token revoked/ei löydy → ystävällinen virheviesti.

### Mitä ei muuteta
- `/athlete/$key` säilyy täysin nykyisellään kirjautuneille; jakolinkki on lisäys.
- `seuraa.$token`-reitti ja muut näkymät ennallaan.
- Hakuun ei muuteta mitään muuta kuin tokenisointi.

## Tekniset huomiot
- `EventGroupView` voidaan käyttää uudelleen sellaisenaan; jaetussa näkymässä ohitetaan `RequireRole` ja muistiinpano-UI.
- Mahdollinen `was_pb`-päivitys/`mark_pbs_for_competitions` ei tarvitse muutoksia — jaettu näkymä lukee samaa dataa.
- Reitin nimi `urheilija.$token` valittu tarkoituksellisesti erilliseksi `/athlete/$key`:stä, koska polku on eri (token vs key) ja julkinen pinta pidetään selvästi erillään.
