## Muutos

Ilmoittautuneet-listalla (`src/routes/round.$eventId.$roundId.tsx`) näytetään tällä hetkellä SB tai PB (vain toinen). Muutetaan niin, että molemmat näytetään kun ne ovat saatavilla.

- Jos `e.SB` löytyy → rivi "SB {arvo}"
- Jos `e.PB` löytyy → rivi "PB {arvo}"
- Mahdollinen `#Number` säilyy ylimpänä

Sama looginen muutos voidaan tehdä myös erälistaukseen (saman tiedoston "ei vielä tulosta" -lohko), jotta käytös on yhtenäinen — mutta tämä koskee tiukasti vain käyttäjän pyytämää ilmoittautumislistaa, joten tehdään muutos vain enrollment-osioon ellei toisin pyydetä.

Ei muutoksia muihin tiedostoihin tai datakerrokseen.
