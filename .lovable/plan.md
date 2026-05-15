## Vahvistettu bugi

T11 60m juoksussa (esim. **Tampere Junior Indoor Games 2026**, kisa 18978) on sekä alkuerät että loppukilpailu samalla `event_id`:llä (493848). Tietokannassa on kuitenkin tallennettu vain alkuerien aika:

| Urheilija | Alkuerä | Finaali | DB:ssä |
|---|---|---|---|
| Helmi Kork | 8,78 | **8,70** | 8,78 ❌ |
| Iida Pesonen | 9,23 | **9,13** | 9,23 ❌ |
| Siiri Aavikko | 9,33 | **9,20** | 9,33 ❌ |
| Liina Tytykoski | 9,37 | **9,31** | 9,37 ❌ |

Sama tilanne on todennäköisesti kaikissa kisoissa, joissa on alkuerät + finaali samalla event_id:llä.

## Syy

`src/routes/api/public/hooks/harvest-results.ts` (rivit 153–209) iteroi `ev.Rounds` järjestyksessä ja työntää jokaisesta allokaatiosta rivin `pending`-listaan. Upsert tehdään näin:

```ts
.upsert(slice, {
  onConflict: "athlete_key,competition_id,event_id",
  ignoreDuplicates: true,
})
```

Koska `Rounds[0] = "Alkuerät"` ja `Rounds[1] = "Loppukilpailu"`, ja konfliktissa **ensimmäinen rivi voittaa** (`ignoreDuplicates: true`), alkuerän aika jää tietokantaan ja finaali hylätään.

## Korjaus

### 1. Harvesterin logiikka

Tiedostossa `src/routes/api/public/hooks/harvest-results.ts`:

- Kerätään urheilijoiden tulokset event-kohtaisesti `Map`iin avaimella `athlete_key` ennen pushaamista `pending`-listaan.
- Jokaiselle (event, athlete) -parille valitaan **paras tulos** käyttäen olemassa olevaa logiikkaa (Track = pienin numeerinen, Field = suurin). `bestPerAthlete`/`isTrackBetter`-tapaista vertailua löytyy jo `src/lib/season-leaders.ts`:stä — sama sääntö tähän.
- Jos vertailu ei onnistu (esim. `result_numeric` puuttuu mutta toisella on), suositaan kierrosta jonka `Round.Name` on "Loppukilpailu" / "Final" jne. yli "Alkuerät"/"Heats".

Näin syöttöön menee vain yksi rivi per (athlete, competition, event), eikä `ignoreDuplicates`-järjestysongelmaa enää ole.

### 2. Olemassa olevan datan korjaus

Pelkkä koodimuutos ei korjaa jo tallennettuja vääriä rivejä, koska upsert ohittaa ne `ignoreDuplicates: true`:n vuoksi tulevillakin ajoilla. Vaihtoehdot:

- **A.** Vaihdetaan `ignoreDuplicates: false` ja annetaan upsertin päivittää rivi → mutta silloin pitää varmistaa että rivit menevät sisään parhaimmuusjärjestyksessä (toteutuu kun deduplikointi tehdään ennen flushia, kuten yllä). Tämä on suositeltava ratkaisu, koska se korjaa myös tulevat uudelleenharvestointi-ajot.
- **B.** Lisätään kertaluonteinen migraatio/skripti, joka käy läpi kisat joissa on useampi `Round` per event ja päivittää `athlete_results`-rivit oikeaksi.

Tehdään **A** + manuaalisesti uudelleenharvestoidaan vaikuttaneet kisat (tai lisätään pieni admin-toiminto ajaa harvesteri uudelleen yhdelle kisalle).

## Tiedostot

- `src/routes/api/public/hooks/harvest-results.ts` — deduplikointi event-tasolla + `ignoreDuplicates: false`.
- (Valinnainen) admin-painike / cron, joka uudelleenajaa harvesterin kisoille joissa `Rounds.length > 1`.

## Vaikutus

- "Kauden kärki" -näkymä (sekä urheilija- ja seuranäkymät) näyttää oikein finaaliajan, ei alkuerän aikaa.
- Sijoitukset (`result_rank`) tulevat jatkossa finaalin mukaan, mikä on oikea käytäntö.
