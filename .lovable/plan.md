# Korjaus: tulos näkyy aina mobiilissa

## Ongelma
`src/components/RecordsPanel.tsx` renderöi tulokset 4-sarakkeisena taulukkona (Pvm / Kilpailu / Tulos / Sija) `overflow-x-auto`-kääreessä. Kapealla puhelinnäytöllä (esim. 374 px) Kilpailu-sarakkeen pitkät nimet + Ulko/Halli-badge työntävät Tulos-sarakkeen osittain näkymän ulkopuolelle. Käyttäjä joutuisi scrollaamaan vaakaan nähdäkseen ei-PB-tuloksen ja tuulilukeman — mutta sivu ei käytännössä mahdollista vaakascrollia kortin sisällä, joten tulos jää piiloon.

## Ratkaisu

Muutos vain `src/components/RecordsPanel.tsx`:ssä — pidetään olemassa oleva taulukkorakenne desktopilla ja tehdään mobiilille selkeämpi layout.

1. **Yhdistä Sija Tulos-soluun mobiilissa**: piilota oma Sija-sarake `< sm` -leveydellä (`hidden sm:table-cell`) ja näytä sija pienenä `· 3.` -merkintänä Tulos-solun perässä mobiilissa.
2. **Anna kilpailunimen rivittyä**: poista `truncate` Kilpailu-solusta mobiilissa (`sm:truncate`), jotta Tulos-sarake ei joudu kilpailemaan tilasta. Badge (Halli/Ulko) ja sijainti rivittyvät luonnollisesti.
3. **Lukitse Tulos-sarake oikealle**: lisää `w-px` + `whitespace-nowrap` (jo on) ja anna PB/Halli-PB/Ulko-PB-badge mennä omalle riville tuloksen alle mobiilissa (`flex flex-col items-end sm:flex-row sm:items-center`), jotta badge ei työnnä numeroa pois näkyvistä.
4. **Tuulilukema** siirtyy tuloksen alle samaan flex-pinoon, jotta se ei vie vaakatilaa.
5. Säilytä `overflow-x-auto` varmuuden vuoksi, mutta käytännössä mobiilissa ei enää tarvita vaakascrollia.

## Mitä EI muuteta
- Taulukon data, järjestys, PB-laskenta — ennallaan.
- Desktop-näkymä — visuaalisesti sama (sm-breakpointin yläpuolella).
- Muut komponentit, reitit tai jaettu urheilijakortti.
