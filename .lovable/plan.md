## Otsikko "Kuuluttajan näkymä" yläpalkkiin

Lisätään pieni yläotsikko (label) kuuluttajan sivun yläpalkkiin, kisan nimen yläpuolelle, jotta käyttäjä näkee heti missä näkymässä on.

### Muutos
Tiedostossa `src/routes/announcer.tsx` lisätään kisan nimen yläpuolelle pieni uppercase-teksti:

```tsx
<p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
  Kuuluttajan näkymä
</p>
<h1 className="...">{name || `Kisa #${competitionId}`}</h1>
```

Sijainti: `min-w-0 flex-1`-divin sisällä, ennen `<h1>`-elementtiä. Tyyli sopii olemassa olevaan minimalistiseen yläpalkkiin (sama tracking ja koko kuin alarivin metatiedoissa).
