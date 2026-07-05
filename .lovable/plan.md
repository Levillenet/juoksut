Korjataan PB-vertailu niin, että Väli-Klemelä Stellan T11 60m aidat -tuloksessa uusi ennätys 11.53 vertautuu aiempaan ennätykseen 11.55, eikä vanhaan moniottelun aikaan 11.71.

Toteutus:
1. Päivitetään lajien normalisointi niin, että moniottelun alalajit kuten `T11 4-ottelu  60m aidat` ryhmittyvät samaan PB-lajiin kuin `T11 60m aidat`.
2. Varmistetaan, että PB-avain säilyttää aitojen speksin (T11 60m aidat, 60 cm / 8 aitaa), jotta eri ikäluokat eivät sekoitu.
3. Tarkistetaan, että historiahaussa Stellan T11 60m aidat -paras ennen Kouvola Junior Gamesia on 11.55.
4. Varmistetaan näkymästä, että badgessa näkyy uusi ennätys 11.53 ja vanhana PB:nä 11.55, eikä 11.71.

Teknisesti muutos kohdistuu ensisijaisesti `src/lib/event-name.ts` normalisointiin ja tarvittaessa PB-avaimen testaukseen/varmennukseen olemassa olevia historiafunktioita vasten.