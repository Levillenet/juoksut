## Mitä muutetaan

`src/components/DailyBestSection.tsx`:n päivän parhaiden listassa jokainen rivi on tällä hetkellä pelkkä `<li>`, jossa vain urheilijan nimi on linkki urheilijakortille. Tehdään rivin muusta alueesta (laji, kilpailun nimi, tulos) linkki kisanäkymään, mutta urheilijan nimi säilyy omana linkkinä urheilijakortille.

## Miten linkki kisaan toimii

Sovelluksessa ei ole erillistä "kilpailun etusivua" — lähin vastine on erän näkymä `/round/$eventId/$roundId`, joka käyttää aktiivista kisa-ID:tä storesta ja hakee tapahtuman tiedot sen mukaan.

Käytettävissä olevista kentistä (`competition_id`, `event_id`) ei saada `roundId`:tä suoraan, mutta `round`-reitin koodi putoaa takaisin ensimmäiseen erään, jos annettua roundId:tä ei löydy:

```
data?.Rounds.find((r) => r.Id === parseInt(roundId, 10)) ?? data?.Rounds[0]
```

Hyödynnetään tätä: navigoidaan `/round/$eventId/0` ja se näyttää lajin ensimmäisen (tyypillisesti ainoan/finaalin) erän tulokset siitä kisasta.

## Rivin rakenne

1. Tuodaan `useCompetitionId` paketista `@/lib/competition-store` ja `useNavigate` reitittimestä.
2. Tehdään rivin "ulkokuori" napiksi tai `Link`iksi joka:
   - Asettaa aktiivisen kisan: `setCompetitionId(r.competition_id)`
   - Navigoi: `navigate({ to: "/round/$eventId/$roundId", params: { eventId: String(r.event_id), roundId: "0" } })`
3. Urheilijan nimi pysyy sisäkkäisenä `Link`inä urheilijakortille. Pysäytetään klikin kuplinta `e.stopPropagation()`:lla, jotta nimen klikkaus ei laukaise myös rivin navigointia.
4. Lisätään `hover:bg-secondary` ja `cursor-pointer` -tyylit visuaaliseksi vihjeeksi siitä, että rivi on klikattavissa.

## Tekninen huomio

Rivin ulkokuori on toteutettava `<button>`-elementtinä tai oman `onClick`-handlerin kautta, koska sisäkkäiset `<a>`-tagit (Link Linkin sisällä) eivät ole sallittuja HTML:ssä. Urheilijan nimen Link säilyy normaalina `<a>`-tagina sisällä.

## Tiedostot

- `src/components/DailyBestSection.tsx` — ainoa muokattava tiedosto.
