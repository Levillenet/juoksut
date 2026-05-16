
## Korjaus: hyppy- ja heittolajit eivät näy hauskoissa tilastoissa

### Syy

`fun-stats.ts` etsii lajeja `event_category === "Jump"` / `"Throw"` -arvoilla, mutta tietokannassa `event_category` saa vain arvot `Field` / `Track` / `Relay` / `Street`. Hyppy- ja heittotieto on `sub_category`-sarakkeessa: `HorizontalJump`, `VerticalJump`, `Throw`. Siksi Hyppykirppu ja Heittotykki -kortit jäävät tyhjiksi.

### Muutokset (`src/lib/fun-stats.ts`)

1. Lisää `sub_category` SELECT-listaan ja `Row`-tyyppiin.
2. Luokittelussa:
   - **Hyppykirppu**: `sub_category === "HorizontalJump" || sub_category === "VerticalJump"`
   - **Heittotykki**: `sub_category === "Throw"`
3. Juoksumetrit ja juoksuaika säilyvät `event_category === "Track"` -ehdolla (oikein).

Ei muita muutoksia, ei DB-muutoksia.
