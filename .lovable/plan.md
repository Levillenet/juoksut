## Muutos kuuluttajan näkymään (`src/routes/announcer.tsx`)

### 1. Lopputulokset auki automaattisesti

`UpcomingItem`-komponentille lisätään uusi prop `defaultOpen?: boolean`. Jos `open`-propia ei hallita ulkoa, komponentti käyttää sisäistä tilaa, jonka alkuarvo tulee `defaultOpen`-propista.

Käytännössä Lopputulokset-listan kutsuun lisätään `defaultOpen`. Jotta sama `expanded`-Set ei pakota kaikkia muiden paneelien kortteja auki, hallinta siirretään niin että:

- Lopputulokset-kortit hallitsevat itse open/close-tilansa (alkuarvo = auki).
- Käynnissä- ja Seuraavaksi-paneelien `expanded`-Set jää nykyiselleen.

### 2. "Merkitse luetuksi" -nappi piilottaa kortin

- Lisätään uusi local-storage-pohjainen tila `dismissedCompletedIds: Set<number>` (avain esim. `announcer-dismissed-{competitionId}-{todayKey}`, jotta seuraavana kisapäivänä alkaa puhtaalta pöydältä ja samalla selaimella säilyy päivän aikana).
- `completed`-listasta suodatetaan pois ne `Round`-rivit, joiden `Id` on `dismissedCompletedIds`-joukossa.
- `UpcomingItem`-komponentille lisätään valinnainen prop `onDismiss?: () => void`. Kun se on annettu, kortin alaosassa (auki-tilassa) näytetään "Merkitse luetuksi" -nappi, joka kutsuu `onDismiss`.
- Lopputulokset-kutsuun annetaan `onDismiss={() => dismissCompleted(r.Id)}`, joka lisää id:n joukkoon ja päivittää localStorageen.
- Otsikon laskuriin (`completed.length`) käytetään suodatettua määrää, jotta luku vastaa näkyviä kortteja. Headerin "X valmis" säilyy alkuperäisessä `completedAll.length`-luvussa, jotta kuuluttaja näkee kuinka monta lajia on yhteensä valmistunut.
- Lisätään pieni "Palauta piilotetut (n)" -linkki Lopputulokset-otsikon viereen, jos `dismissedCompletedIds.size > 0`, jotta vahingossa piilotetun saa takaisin.

### Mitä ei muuteta

- Käynnissä-paneelin `EventCard` ja sen avaus/sulkeminen.
- Seuraavaksi-paneelin `UpcomingItem` (jää käyttämään `expanded`-Setiä, ei avaudu automaattisesti, ei "Luettu"-nappia).
- Datalähteet, queryt, ennätyslogiikka, eräryhmittely.

### Lopputulos

Kuuluttaja näkee Lopputulokset-paneelissa jokaisen valmistuneen lajin sijoitukset valmiiksi auki ilman klikkausta. Kun laji on luettu kuulutuksessa, "Merkitse luetuksi" -napin painallus piilottaa kortin näkyvistä, jolloin lista pysyy lyhyenä ja seuraavat luettavat lajit erottuvat selvästi. Tarvittaessa piilotetut saa takaisin "Palauta piilotetut" -linkistä.