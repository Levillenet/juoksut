## Ongelma

Bulk-add-toiminto on jo olemassa `/watch`-sivulla, mutta se on piilotettu pienenä katkoviivakorttina **"Seuran ohjelma" -osion sisälle** ja tulee näkyviin vasta kun käyttäjä on valinnut seuran sieltä. Käyttäjän mielikuvassa kyse on omasta toiminnosta ("valitse seura → valitse ikäluokat → lisää seurantaan"), eikä hän yhdistä sitä "Tulosta ohjelma" -korttiin. Siksi näyttää siltä, ettei toimintoa ole olemassa.

## Korjauksen idea

Tehdään tästä oma, erillinen osio `/watch`-sivulle, jossa flow on selkeästi kaksivaiheinen:

1. **Vaihe 1 — Valitse seura**: oma seuravalitsin (sama lista kuin nykyinenkin), otsikolla "Lisää seuran urheilijat seurantaan".
2. **Vaihe 2 — Valitse ikäluokat**: kun seura on valittu, näytetään ikäluokkachipit (esim. `T8 (5)`, `T10 (3)`), joista voi valita yhden tai useamman. Mukana "Valitse kaikki" -pikalinkki.
3. **Toiminto**: "Lisää N urheilijaa seurantaan" -nappi, joka kertoo paljonko **uusia** lisätään (jo seurattavat eivät kasvata lukua). Onnistumisen jälkeen toast + chip-valinnat tyhjenevät.

"Seuran ohjelma" -osio jää ennalleen tulostusta varten, mutta nykyinen sisäinen bulk-add-kortti poistetaan sieltä, jotta toiminto ei ole kahdessa paikassa.

## Sijoittelu sivulla

```text
[Hakukenttä sukunimellä]      ← jo olemassa
[Hakutulokset]                 ← jo olemassa, näkyy haettaessa

▸ Lisää seuran urheilijat seurantaan   ← UUSI oma osio (näkyvä heti)
   1) Seuravalitsin
   2) Ikäluokkachipit (kun seura valittu)
   3) "Lisää N seurantaan" -nappi

▸ Seuran ohjelma                       ← ennallaan, vain tulostusta varten
   Seuravalitsin + "Tulosta ohjelma"

▸ Seurannassa olevat urheilijat        ← ennallaan
```

Uusi osio sijoitetaan **ennen** "Seuran ohjelma" -osiota, jotta se on löydettävissä.

## Tekniset muutokset

Kaikki muutokset `src/routes/watch.tsx`:ssä — ei backend- tai datamuutoksia (data `clubAgeClasses`, `bulkAddSelection`, `addSelectedToWatch`, `toggleAgeClass` on jo olemassa).

- Eriytä bulk-add omaan `<section>`:iin omalla `selectedBulkOrgId`-tilalla (erillinen seuran ohjelma -valitsimesta, jotta käyttäjän ei tarvitse vaihtaa kontekstia).
- `clubAgeClasses`-memo viittaamaan `selectedBulkOrgId`:hen.
- Lisää "Valitse kaikki / Tyhjennä" -pikatoiminto chippien yläpuolelle.
- Napin teksti muotoon `"Lisää N urheilijaa seurantaan"` (tai disabloitu kun N=0). Tooltip/aputeksti: "Jo seurattavia ei lisätä uudestaan."
- Poista nykyinen katkoviivakortti `Seuran ohjelma` -osion sisältä (rivit ~442–...).
- Mobiili: chipit `flex-wrap`, samanlainen tyyli kuin nykyiset.

## Mitä EI tehdä

- Ei muuteta tietokantaa, watch-storea eikä index-sivun "Päivän parhaat" -osiota.
- Ei kosketa `harvest-results.ts`:ään.
