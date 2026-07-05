## Lyhyt ohjekortti videot-sivulle

Lisää `/videot`-sivulle (src/routes/videot.tsx) otsikon ja suodattimien väliin taitettava ohjekortti "Miten lisään oman videon?", oletuksena kiinni. Ei muuta toimintaa – vain ohjeteksti.

### Sisältö

Ohje kolmena numeroituna askeleena + huomautus lajeista:

1. **Lataa video omalle YouTube-tilillesi.** Aseta se tarpeen mukaan **Piilotettu (Unlisted)** -tilaan, jolloin sitä ei löydä hausta mutta linkillä voi katsoa.
2. **Kopioi videon linkki** YouTuben "Jaa"-toiminnolla.
3. **Liitä linkki urheilijaseurannassa** oikean urheilijan oikeaan juoksuerään (YouTube-nappi rivin lopussa).

**Huom:** Juoksulajien videot voi asettaa julkiseksi tai yksityiseksi. Kenttälajien videot ovat aina yksityisiä ja jäävät vain sinulle omaan arkistoosi myöhempää katselua varten.

### Toteutus

- Kortti `<details>`-elementillä (natiivi avaus/piilotus, ei extra deppaa) tai olemassa olevalla `Collapsible`-shadcn-komponentilla jos se on jo käytössä.
- Sijoitus: heti otsikkokappaleen alle, ennen suodatinruudukkoa.
- Tyyli: `rounded-xl border bg-card`, otsikkona esim. "❓ Miten jaan oman videon?" jotta erottuu selkeästi.

Ei muita muutoksia.
