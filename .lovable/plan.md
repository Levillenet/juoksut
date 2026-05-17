Korjaan yhdistetyn näkymän niin, että Käynnissä-osio ei enää varaa sarakepaikkaa silloin kun siellä ei ole yhtään näytettävää lajia.

Toteutus:
1. Muutan `/announcer/combined`-näkymän sarakelogiikkaa: jos `Käynnissä` on asetuksissa näkyvissä mutta `data.inProgressVisible.length === 0`, sitä ei lasketa mukaan renderöitäviin sarakkeisiin.
2. Tällöin `Lopputulokset` ja `Seuraavaksi` siirtyvät automaattisesti vasemmalle eivätkä jätä tyhjää väliä.
3. Säilytän käyttäjän asetukset ennallaan: Käynnissä voi edelleen olla valittuna asetuksissa ja ilmestyy takaisin heti kun käynnissä olevia lajeja löytyy.
4. Teen saman tarvittaessa tulos/planning-näkymään, jos siellä käytetään samaa sarakeasettelua ja tyhjä Käynnissä aiheuttaa saman välin.

En muuta live-näkymän asetuksia, tuloshakuja tai ticker-logiikkaa tässä korjauksessa.