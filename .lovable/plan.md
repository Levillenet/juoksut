Korjaan YAG Callingin erätulkinnan niin, että T11 60m alkuerät näkyvät julkaistuina samalla datalla kuin kilpailijaseurannassa.

Havainto:
- Tuloslistan datassa T11 60m alkuerät ovat `Allocated` ja niissä on 10 erää.
- Sama eventti sisältää myös myöhemmän `Loppukilpailu`-kierroksen, joka on vielä `Unallocated`.
- Calling-matchaus käsittelee nyt koko eventin ilmoittautuneet / julkaisemattomat entryt liian laveasti ja voi yhdistää tulevan finaalin julkaisemattomuuden alkuerien ryhmään.

Suunnitelma:
1. Päivitä indeksin muodostus (`competitionIndexQueryOptions`) niin, että `Enrollments`-fallbackia käytetään vain niille kierroksille, joilla ei ole eräjakoa, eikä silloin kun saman eventin toinen kierros on jo allokoitu.
2. Lisää `IndexedEntry`-tietoon kierroskohtainen tunniste tarvittaessa, jotta Calling pystyy erottamaan alkuerät ja loppukilpailun samasta eventistä.
3. Päivitä YAG Calling -matchaus käyttämään kierroksen nimeä mukana lajiavaimessa: `60m alkuerät` ei saa matchata `60m loppukilpailu` -kierroksen julkaisemattomia osallistujia.
4. Pidä nykyinen overflow-logiikka: jos virallinen calling-PDF sisältää vähemmän erärivejä kuin Tuloslista, ylimääräiset julkaistut erät liitetään viimeiselle calling-riville huomautuksella.
5. Tarkista T11 60m datalla, että alkuerissä syntyy julkaistut rivit erille 1–10 eikä “ei vielä julkaistu” -riviä alkuerien alle.