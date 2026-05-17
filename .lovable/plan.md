## Ongelma

"Hallinnoi linkityksiä" -painike ei navigoi. Edellisessä kierroksessa se vaihdettiin muotoon `Button asChild + Link`, joka ei toimi luotettavasti (Radix Slot + TanStack Link -ketju).

## Korjaus

`src/routes/settings.tsx`: palauta vain `Hallinnoi linkityksiä` -painike alkuperäiseen toimivaan pelkkä-`<Link>` -muotoon:

```tsx
<Link
  to="/settings/note-links"
  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-secondary"
>
  <Link2 className="h-4 w-4" />
  Hallinnoi linkityksiä
</Link>
```

`Hallinnoi tiimejä` -osio pysyy ennallaan virkailija-gaten takana (tiimiominaisuus ei ole vielä valmis peruskäyttäjille).

Muu sisältö ja näkyvyyssäännöt eivät muutu.
