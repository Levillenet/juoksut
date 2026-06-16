# Sijoittamattomien lajien blokit Ganttiin

## Tavoite

Tällä hetkellä solverin sijoittamatta jättämät lajit näkyvät vain tekstivaroituksina. Lisätään Gantt-näkymään (`PlannerFullGantt`) erillinen **"Sijoittamattomat lajit"** -lohko aikajanan yläosaan. Käyttäjä näkee blokit ja voi raahata ne suoraan oikealle suorituspaikalle ja kellonajalle, jolloin syntyy uusi `plan_schedule_items`-rivi.

## Muutokset

### 1. `src/components/planner/PlannerFullGantt.tsx`

- Lasketaan `unplacedEvents`: ne `events`, joilla EI ole yhtään `schedule`-riviä (`plan_event_id` puuttuu schedulesta kokonaan).
- Lisätään uusi sticky-osio aikajanan yläosaan ennen "Suorituspaikkakohtainen aikataulu" -osiota:
  - Otsikko "Sijoittamattomat lajit" (punainen/oranssi tausta jotta erottuu).
  - Yksi rivi per sijoittamaton laji.
  - Blokin leveys = lajin kesto (`resolveTimings(ev, plan).durationMin`), kuten tavallisetkin blokit.
  - Blokin alkukohta: vasen reuna (offset 0 = päivän aloitusaika), jotta blokit löytyvät heti.
  - Tyylit: punainen reunus + viiraus, sama värikoodi kuin lajilla muutoin, kursori grab.
- Sama blokki näkyy KAIKKINA päivinä kunnes se sijoitetaan (näin käyttäjä voi raahata sen haluamalleen päivälle).

### 2. Drag & drop sijoittamattomille

- Annetaan blokille `data-bar-id="unplaced-{eventId}"` ja oma `data-unplaced="1"` -lippu.
- Laajennetaan `onPointerDown`/`onPointerUp` käsittelemään sentinel-id:
  - Liikkuminen toimii samalla logiikalla (x → minuutit, y → rivi-indeksi venue-osiossa).
  - `onPointerUp`-vaiheessa, jos `unplaced` ja drop osuu venue-riville, joka tukee lajia (`isVenueForEvent`):
    - Lasketaan `starts_at = startMs + minutes*60000`, `ends_at = starts_at + durationMin*60000`.
    - Tehdään `INSERT` `plan_schedule_items`-tauluun (uusi mutaatio `createItem`): `plan_event_id`, `venue_id`, `starts_at`, `ends_at`, `phase: 'final'`, `auto_generated: false`.
    - Kutsutaan `onChange()` jolloin schedule refetchataan ja blokki siirtyy "Sijoittamattomat"-osiosta venueen.
  - Jos drop osuu väärän tyyppiselle venuelle → `toast.error` kuten nykyäänkin, blokki palaa.
  - Jos käyttäjä vain klikkaa (ei vedä) → ei mitään (ei `onSelectItem`-kutsua, koska id ei ole oikea schedule-id).

### 3. Visuaalinen vihje
- Lisätään legendaan merkki "Sijoittamaton – raahaa paikalleen".
- Jos `unplacedEvents.length === 0`, osio piilotetaan kokonaan.

## Mitä EI muuteta

- Solveria (`planner-solver.ts`) ei kosketa. Sijoittamattomat tulevat edelleen `events`-listasta vertaamalla `schedule`-riveihin.
- Konfliktilogiikkaa ei muuteta.
- Tietokantaskeemaa ei muuteta — `plan_schedule_items` riittää sellaisenaan.

## Validointi

1. Generoi YAG (kopio) -aikataulu.
2. Ennen: 21 sijoittamatonta lajia näkyy vain varoitustekstinä.
3. Jälkeen: 21 punaista blokkia näkyy "Sijoittamattomat lajit" -osiossa Ganttin yläreunassa.
4. Raahataan yksi blokki vapaalle ovaaliradan slotille → INSERT onnistuu, blokki siirtyy venue-riville, "Sijoittamattomat"-listaus pienenee yhdellä.
5. Raahataan blokki väärän tyyppiselle venuelle → toast-virhe, ei muutosta.
