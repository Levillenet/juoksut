## Ongelma

Calling-listan rivit järjestetään kellonajan **tekstivertailulla** (`"8:18–8:28"` vs `"10:50–11:00"`). Tekstinä "10" ja "11" tulevat ennen "8":aa, joten aamun klo 8–9 lähdöt putoavat listan loppuun 13.6:n kohdalla.

## Korjaus

Lisätään apufunktio, joka parsii calling-ajan alkuajan minuuteiksi (esim. "8:18–8:28" → 498 min) ja järjestetään rivit sen mukaan numeerisesti.

Muutoskohdat:
1. **`src/lib/yag-calling-match.ts`** — apufunktio `callingStartMinutes()` + ryhmän sisäinen rivijärjestys aikajärjestykseen (vaikuttaa myös "ei vielä julkaistu" -rivien erälistan järjestykseen).
2. **`src/routes/print.yag-calling.tsx`** — päivänäkymän rivijärjestys aikajärjestykseen (sama data menee myös PDF-lataukseen, joten PDF korjautuu samalla).

Lopputulos: jokaisen päivän rivit kulkevat aamusta iltaan (8:03 → 8:18 → 10:50 → … → 18:35) sekä näytöllä että ladatussa PDF:ssä.