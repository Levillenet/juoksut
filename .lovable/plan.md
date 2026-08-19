# Vanhat tulokset säilytetään ennallaan

## Tilanne

`athlete_results` sisältää 422 903 tulosriviä, vanhin 1.7.2021. Näistä 121 147 on yli 400 vrk vanhoja. Mitään tulosrivejä ei ole poistettu eikä arkistoitu.

Aiempi siivous kohdistui vain väliaikaisdataan:
- tuloslistan välimuisti (yli tunnin vanhat rivit)
- analytiikkatapahtumat yli 180 vrk
- probe- ja kutsulokit (30 / 90 vrk)

## Päätös

Vanhat tulokset jätetään ennalleen samaan tauluun. Ei arkistotaulua, ei poistoja.

## Toimenpiteet

Ei koodi- tai tietokantamuutoksia. Päivittäinen siivousajo (klo 03:20) jatkuu nykyisellään ja koskee vain välimuistia ja lokeja, ei tuloksia.
