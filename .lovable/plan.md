# Hauskat tilastot: aina kalenterivuosi

## Tavoite

Hauskat tilastot lasketaan aina kuluvalta kalenterivuodelta (1.1.-31.12.). Kausivalinta (Kuluva vuosi / Kesäkausi / Talvikausi) poistuu, jotta esimerkiksi viesti- ja katulajitilastot eivät katkea kesken kauden.

## Muutokset

- Poistetaan kausivalitsin sivulta `Hauskat tilastot`.
- Kaikki haut (seuralista, ikäluokat, itse tilastot) käyttävät kiinteästi kalenterivuosirajausta.
- Otsikossa näytetään selkeästi kuluva vuosi, esimerkiksi "Tilastot 2026".
- Aiemmin tallennettu kausivalinta selaimen muistista jätetään huomiotta.

## Tekniset yksityiskohdat

- `src/routes/hauskat-tilastot.tsx`: poistetaan `season`-tila, `SEASON_OPTIONS`, `SEASON_STORAGE_KEY` ja kausivalitsin. Käytetään vakioarvoa `"year"` ja `seasonRange("year")`. Query-avaimista poistetaan `season`.
- `src/lib/fun-stats.ts` säilyy ennallaan (funktiot ottavat edelleen `SeasonKind`-parametrin), sille välitetään aina `"year"`.
- Ei tietokantamuutoksia.
