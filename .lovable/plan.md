## Toteutus

Migraatio ajettu: `result_videos.heat_results jsonb` -sarake ja `set_heat_results_if_null(uuid, jsonb)` -RPC ovat valmiina.

### 1. `src/lib/result-videos.ts`
- Uusi tyyppi `HeatResultSnapshot = { position, surname, firstname, organization, result_text, result_rank }`.
- `ResultVideo`iin lisää `heat_results: HeatResultSnapshot[] | null`.
- `SELECT_COLS`iin `heat_results`.
- `insertResultVideo`iin optionaalinen `heatResults?: HeatResultSnapshot[] | null`; kirjoitetaan riville.

### 2. `src/components/ResultVideoButton.tsx`
- Uusi prop `heatSnapshot?: HeatResultSnapshot[] | null`.
- Välitä `VideoForm`iin, sieltä `insertResultVideo`n `heatResults`-parametriin.

### 3. `src/routes/round.$eventId.$roundId.tsx`
- Erän `ResultVideoButton`-kutsuun rakennetaan `heatSnapshot` `allocs`ista: `position: a.Position, surname: a.Surname, firstname: a.Firstname, organization: a.Organization?.Name ?? null, result_text: a.Result, result_rank: a.ResultRank`.

### 4. `src/lib/public-videos.ts`
- Lisää `heat_results` `PublicVideoItem`iin ja SELECT-listaan `fetchPublicVideos`issa.
- Poista `fetchHeatResults` (ei enää käytössä).

### 5. `src/routes/videot.tsx`
- `HeatResultsToggle` lukee `video.heat_results`ista suoraan — ei enää useQuery/haku.
- Jos snapshot on olemassa: renderöi listaus (sija, nimi, seura, tulos), järjestä `result_rank` mukaan (nulls last, sitten position).
- Jos snapshot on null: käynnistä kertaluontoinen backfill:
  - Fetch live: `fetchEvent(competitionId, event_id)` — mutta event_id ei ole `PublicVideoItem`issa nyt.
  - **Ratkaisu**: lisää `event_id` `PublicVideoItem`iin (hae `athlete_results`ista competition_id + event_name -parilla, ottaen yhden tuloksen). Tämä on jo `results`-haussa `fetchPublicVideos`issa — lisää `event_id` sen SELECTiin ja välitä.
  - Etsi live-datasta `Rounds[*].Heats[*]` jonka `Id === heatIdFromAthleteKey`, muunna `Allocations` snapshotiksi.
  - Kutsu RPC `set_heat_results_if_null(video_id, snapshot)` — tallentaa vain jos yhä null.
  - Näytä tulokset heti UI:ssa; onnistuneen kirjoituksen jälkeen invalidoi `public-videos-archive` -kysely, jolloin seuraavat lataukset saavat snapshotin suoraan.
- Jos live-fetch epäonnistuu (vanha kisa 404): näytä "Ei tuloksia tallennettu tälle videolle".

### Käytös
- **Uudet erävideot**: snapshot tallennetaan heti lisäyshetkellä (kohta 3).
- **Vanhat erävideot**: ensimmäinen käyttäjä joka avaa "Näytä erän tulokset" laukaisee live-haun + RPC-tallennuksen. Seuraavat käyttäjät näkevät ne heti kannasta.
