import type { ReactNode } from "react";

const PARAGRAPHS: ReactNode[] = [
  "Tulosjärjestelmä on tehty helpottamaan kilpailujen seuraamista ja tekemään urheilusta mielekkäämpää niin urheilijoille kuin tapahtumia seuraaville. Järjestelmän tarkoitus ei ole lisätä lasten tai urheilijoiden keskinäistä vertailua. Osa harrastaa tavoitteellisesti ja osa enemmän omaksi ilokseen, ja molemmat ovat yhtä arvokkaita tapoja urheilla.",
  "Tulosten seuranta ei saisi aiheuttaa urheilijoille ylimääräistä painetta esimerkiksi vanhempien toimesta, vaan kaikkien olisi hyvä ymmärtää, että eri urheilijoilla on erilaiset tavoitteet, lähtökohdat ja motivaatiot. Kukin urheilee omista syistään ja omien tavoitteidensa mukaisesti. Toisilla tavoitteet ovat korkeammalla ja toiset harrastavat enemmän liikunnan ilosta, ja kaikki tämä on täysin ok. Tämän tulospalvelun tarkoitus on tukea kaikkia erilaisia urheilijoita sekä heidän vanhempiaan ja lähipiiriään.",
  "Järjestelmä helpottaa erityisesti kisatapahtumien seuraamista paikan päällä. Monet haluavat kuitenkin tarkastella tuloksia kilpailun aikana, ja tämän avulla omat huollettavat saa helposti yhdelle näytölle ilman jatkuvaa puhelimen selaamista ja eri sivujen etsimistä. Näin kilpailujen seuraaminen on sujuvampaa, aikaa säästyy itse tapahtuman seuraamiseen ja puhelimen käyttö vähenee.",
  "Seurannan jakaminen myös esimerkiksi isovanhemmille, sukulaisille, kavereille ja tutuille on tehty helpoksi. Urheilijaseurannan voi jakaa suoran linkin kautta ilman kirjautumista, jolloin kilpailujen seuraaminen onnistuu vaivattomasti myös niille, jotka eivät ole aktiivisia käyttäjiä.",
  "Järjestelmästä löytyy lisäksi erilaisia hauskoja tilastoja, joihin kerätään myös kevyempiä ja humoristisia asioita kilpailuista. Kaiken ei tarvitse liittyä pelkästään tuloksiin tai menestykseen, vaan mukana on myös erilaisia erikoisempia kilpailutilastoja ja muita hauskoja nostoja, joita on mukava seurata kilpailuiden ohessa.",
  "Urheilijat voivat halutessaan seurata myös omaa kehittymistään pidemmällä aikavälillä. Omat ennätykset säilyvät helposti nähtävillä, jolloin oman kehityksen seuraaminen onnistuu vaivattomasti niille, jotka sitä haluavat tehdä. Lisäksi urheilijatilastoihin voi tehdä omia muistiinpanoja eri lajien ja kilpailujen kohdalle. Sinne voi tallentaa esimerkiksi askelmerkkejä tai muita kilpailuihin liittyviä huomioita, jolloin samoja asioita ei tarvitse muistella uudelleen joka kerta.",
  "Järjestelmään tulevat tulokset ja tilastot haetaan live.tuloslista.com-palvelusta ja näytetään vain hieman eri käyttötarkoituksiin sopivammalla tavalla.",
  <>
    Järjestelmään liittyvissä kehitysasioissa voit olla yhteydessä sähköpostitse:{" "}
    <a
      href="mailto:sami.aavikko@gmail.com"
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      sami.aavikko@gmail.com
    </a>
    .
  </>,
];

export function AboutServiceContent() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground">
      {PARAGRAPHS.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
