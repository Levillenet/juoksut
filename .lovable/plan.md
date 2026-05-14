## Ongelma

`UpcomingItem`-komponenttia käytetään sekä **Seuraavaksi**- että **Lopputulokset**-paneeleissa. Aiemmin tehty erä-jako (Track-laji + useita eriä → Erä 1, Erä 2, …) on hyödyllinen Seuraavaksi-listalla, mutta Lopputuloksissa kuuluttaja haluaa nähdä lajin **lopullisen yhteissijoituksen**, ei eräkohtaista listaa. Esim. T8 40 m näyttää nyt jokaisen erän erikseen sen sijaan että näyttäisi kaikki kilpailijat yhtenä paremmuusjärjestyslistana.

## Muutos

### `src/routes/announcer.tsx`

1. Lisätään `UpcomingItem`-komponentille uusi valinnainen prop `groupHeats?: boolean` (oletus `true` = nykyinen käyttäytyminen).
2. Eräryhmittely-haara (`isTrackHeats`) suoritetaan vain kun `groupHeats === true`. Kun `groupHeats === false`, käytetään aina nykyistä flatten-haaraa (`flatSorted` + `AllocationRow`), joka jo lajittelee `ResultRank`in mukaan kun tuloksia on.
3. Lopputulokset-paneelin `UpcomingItem`-kutsuun (rivi ~417–425) lisätään `groupHeats={false}`. Seuraavaksi-paneelin kutsu (rivi ~457–465) jätetään ennalleen, joten erät näkyvät siellä yhä erikseen.

### Mitä ei muuteta

- `EventCard` (Käynnissä) — siellä ei ole eräjakoa.
- Datalähteet, queryt, baseline- tai ennätyslogiikka.
- `AllocationRow`, `flatSorted`-lajittelu ja `RecordBadge`-esitys säilyvät identtisenä.

## Lopputulos

Lopputulokset-paneelissa esim. "T8 40 m" näkyy auki klikattuna yhtenä lopullisena sijoituslistana (1., 2., 3., …) eräryhmittelyn sijaan. Seuraavaksi-paneelissa eräjako säilyy kuten nyt.
