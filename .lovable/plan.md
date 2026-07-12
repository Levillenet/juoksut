## Ongelma

Erätiedoissa ja osallistujaluetteloissa (`round.$eventId.$roundId.tsx`) SB näytetään ensisijaisena, ja PB vain jos SB puuttuu. Käyttäjän toive: PB on aina ensisijainen; SB näytetään vain, kun PB:tä ei ole.

## Muutos

Tiedosto: `src/routes/round.$eventId.$roundId.tsx`

- Rivit 349-350 (osallistujalista): näytä `PB` jos on, muuten `SB`.
- Rivit 526-527 (eräkohtainen lista): sama logiikka; PB ensin, SB fallback.

```tsx
{eff.pb ? <div>PB {eff.pb}</div> : eff.sb && <div>SB {eff.sb}</div>}
```

Ei muita muutoksia (record-vertailu ja effectiveRecord-logiikka pysyy ennallaan).