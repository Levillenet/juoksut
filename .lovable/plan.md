## Tavoite

Lisätään Kilpailijaseuranta-sivulle (`/watch`) mahdollisuus valita seura alasvetovalikosta ja tulostaa kyseisen seuran päiväkohtainen kilpailuohjelma — listaus lajeittain (alkamisaika + laji + erä/sarja + seuran osallistujat).

## Käyttöliittymä `/watch`

Hakukentän alle uusi paneeli "Seuran ohjelma":
- **Alasvetovalikko (Select)** — listaa kaikki seurat, jotka esiintyvät competition-indexissä (uniikit `Organization.Name`, järjestys aakkosittain). Valikon ylä­osassa hakukenttä (Command/Combobox-tyyli, koska seuroja voi olla satoja).
- Valinnan jälkeen näytetään:
  - Yhteenveto: `{seura} · {N} urheilijaa · {M} lähtöä`
  - Painike **"Tulosta seuran ohjelma"** → avaa `/print/club?org={id}` uuteen välilehteen ja triggeröi `window.print()`.
  - Esikatselu samalla sivulla: päiväkohtainen lista lajeista, joissa seuran urheilijoita kilpailee.

Olemassa oleva yksittäisten urheilijoiden seuranta säilyy ennallaan — uusi toiminto on rinnakkainen tapa.

## Tulostussivu `/print/club`

Uusi route `src/routes/print.club.tsx` (search param `org: number`):
- Käyttää `competitionIndexQueryOptions` -dataa (sama välimuisti kuin `/watch`).
- Suodattaa entryt valitulla `Organization.Id`:llä.
- Ryhmittely: **päivä → laji (round) → urheilijat seurasta**.
  - Lajirivi: aika, laji­nimi, sarja (`SubCategory`), kierros (`Name`), juoksuissa "Erä X / Rata Y".
  - Urheilijarivit lajin alla: `Sukunimi Etunimi` (+ rintanumero jos olemassa, juoksuissa rata).
- Lajit järjestetään alkamisajan mukaan; päivät kronologisesti.
- Sivun ylätunniste: kisan nimi, seuran nimi, "Päiväkohtainen ohjelma", tulostusajankohta.
- Print-CSS: `print:hidden` headerille, `break-inside-avoid` päiväosioille, kompakti taulukkolayout (kuten nykyinen `/print`).

## Tekniset huomiot

- Seuralista johdetaan `competitionIndexQueryOptions`-datasta (`alloc.Organization`). Avain on `Organization.Id` (number) — varaudu `null`:iin (filtteröi pois "ei seuraa" -allokaatiot dropdownista).
- Käytetään olemassa olevaa shadcn `Select` tai `Command` + `Popover` -yhdistelmää (Combobox). Suositus: `Command` koska seuroja voi olla paljon ja haku on tarpeen.
- Päivän avain: `helsinkiDateKey(round.BeginDateTimeWithTZ)` (sama kuin nykyisessä koodissa).
- Saman lajin (round) sisällä urheilijat järjestetään juoksuissa `heatIndex` + `Position` mukaan, kentässä `Position` mukaan.
- Ei tietokanta- tai backend-muutoksia. Ei muutoksia `watched_athletes`-tauluun (tämä on katselu/tulostus, ei pysyvää seurantaa).
- Mobiilinäkymässä (preview 682px) dropdown ja painike pinotaan pystyyn.

## Avoimet kysymykset

Jos seuran osallistujat halutaan myös tallentaa pysyvästi `watched_athletes`-tauluun (kuten yksittäiset urheilijat), lisätään "Lisää kaikki seuraan"-painike joka kutsuu `add()` jokaiselle uniikille urheilijalle. Tämän voi tehdä jos haluat — mutta peruspyyntö (valinta + tulostus) ei sitä vaadi.
