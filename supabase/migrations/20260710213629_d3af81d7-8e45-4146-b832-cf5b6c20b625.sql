UPDATE public.welcome_messages
SET
  title = 'Tiedote: datansiirrossa katkos',
  body = 'live.tuloslista.com -palvelun datansiirrossa on havaittu katkos, minkä takia uudet kilpailutulokset eivät tällä hetkellä päivity palveluumme. Selvitämme asiaa aktiivisesti yhdessä tulospalvelun tuottajan kanssa, jotta voimme palauttaa datan saannin mahdollisimman pian.

Vanhat tulokset, videot ja muut palvelun toiminnot toimivat normaalisti. Pahoittelemme tilapäistä häiriötä ja päivitämme tietoa, kun tilanne etenee.',
  enabled = true
WHERE singleton = true;

INSERT INTO public.welcome_messages (singleton, title, body, enabled)
SELECT true, 'Tiedote: datansiirrossa katkos', 'live.tuloslista.com -palvelun datansiirrossa on havaittu katkos, minkä takia uudet kilpailutulokset eivät tällä hetkellä päivity palveluumme. Selvitämme asiaa aktiivisesti yhdessä tulospalvelun tuottajan kanssa, jotta voimme palauttaa datan saannin mahdollisimman pian.

Vanhat tulokset, videot ja muut palvelun toiminnot toimivat normaalisti. Pahoittelemme tilapäistä häiriötä ja päivitämme tietoa, kun tilanne etenee.', true
WHERE NOT EXISTS (SELECT 1 FROM public.welcome_messages WHERE singleton = true);