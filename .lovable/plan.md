## Ongelma

`src/components/PrintTabs.tsx` käyttää mobiilissa `grid`-layoutia, jossa kaikki välilehdet pakotetaan yhtä leveisiin sarakkeisiin. 374 px näytöllä lyhyetkin lyhenteet ("Aikataulu", "Raportti", "Joukkue") katkeavat `truncate`-luokan takia. Lisäksi YAG-välilehti on näkyvissä vaikka YAG on jo ohi.

## Korjaus (vain `src/components/PrintTabs.tsx`)

1. **Poista YAG-välilehti kokonaan** — pudotetaan `/print/yag-calling`-rivi ja siihen liittyvät `YAG_COMPETITION_ID` / `useCompetitionId` importit.
2. **Vaihda mobiilin layout `flex flex-wrap`-tyyliin** gridin sijaan:
   - Pillit saavat sisällön mukaisen leveyden (`w-auto`), poistetaan `truncate`.
   - Rivit menevät luonnollisesti kahdelle riville kapealla näytöllä, kaikki tekstit näkyvät kokonaan.
   - Näytetään mobiilissakin täydet otsikot (esim. "Kilpailun aikataulu", "Seuran urheilijat") — `shortLabel`-haara voidaan poistaa tai jättää lyhyempänä varmuudeksi hyvin kapeille napeille.
3. Työpöytäkäytös (`sm:`) pysyy ennallaan: yksi rivi, `overflow-x-auto` varmistuksena.

## Vaikutus

- Kilpailun aikataulusivun (`/print/*`) yläreunan välilehtien tekstit näkyvät kokonaan myös mobiilissa.
- YAG-välilehti häviää valikosta kaikilta käyttäjiltä.
- Muut sivut eivät muutu, koska `PrintTabs` on käytössä vain `/print`-alireiteillä.
