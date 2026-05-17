import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowLeft, Settings as SettingsIcon, MapPin, Database, Lightbulb, Users, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  REFRESH_OPTIONS,
  useRefreshIntervalSec,
} from "@/lib/settings-store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Asetukset – Lahden Ahkera" },
      {
        name: "description",
        content: "Sovelluksen asetukset: päivitystiheys ja seurojen sijainnit.",
      },
    ],
  }),
  component: SettingsGate,
});

function SettingsGate() {
  const { role, loading, user } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  }
  if (!role) return <Navigate to="/login" />;
  const isAdmin = (user?.email ?? "").toLowerCase() === "samiaavikko@gmail.com";
  const showOfficialSections = role === "official" || isAdmin;
  return <SettingsPage showOfficialSections={showOfficialSections} />;
}

function SettingsPage({ showOfficialSections }: { showOfficialSections: boolean }) {
  const [refreshSec, setRefreshSec] = useRefreshIntervalSec();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Takaisin">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <SettingsIcon className="h-5 w-5 text-primary" />
          <h1 className="flex-1 text-base font-semibold">Asetukset</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-bold">Päivitystiheys</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Kuinka usein etusivun lajit ja tulokset haetaan automaattisesti.
          </p>
          <div className="flex flex-wrap gap-2">
            {REFRESH_OPTIONS.map((opt) => {
              const on = opt === refreshSec;
              return (
                <button
                  key={opt}
                  onClick={() => setRefreshSec(opt)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-secondary"
                  }`}
                >
                  {opt < 60 ? `${opt} s` : `${opt / 60} min`}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-bold">Muistiinpanojen jakaminen</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Yksinkertainen 1-1-jako: linkitä tilisi toisen käyttäjän kanssa
            sähköpostilla, niin näette toistenne muistiinpanot ristiin. Ei
            vaadi tiimiä.
          </p>
          <Link
            to="/settings/note-links"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-secondary"
          >
            <Link2 className="h-4 w-4" />
            Hallinnoi linkityksiä
          </Link>
        </section>

        {showOfficialSections && (
          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-bold">Tiimit ja jaetut muistiinpanot</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Luo valmennustiimi ja jaa urheilijakohtaiset muistiinpanot tiimin
              jäsenten kanssa.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/settings/teams">
                <Users className="h-4 w-4" />
                Hallinnoi tiimejä
              </Link>
            </Button>
          </section>
        )}

        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-bold">Seurojen sijainnit</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Hallinnoi seurojen kotipaikkoja ja koordinaatteja kauden tilastoja
            varten.
          </p>
          <Link
            to="/admin/club-locations"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-secondary"
          >
            <MapPin className="h-4 w-4" />
            Avaa seurojen sijainnit
          </Link>
        </section>

        {showOfficialSections && (
          <>
            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">Tuloslista API – saatavilla oleva data</h2>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Lähde: <code className="rounded bg-muted px-1 py-0.5 text-[11px]">cached-public-api.tuloslista.com/live/v1</code> ·
                julkinen, CORS-avoin, ei vaadi tunnuksia.
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <h3 className="mb-1 font-semibold">
                    <code>/competition/&lt;id&gt;</code> – kisan aikataulu
                  </h3>
                  <p className="text-muted-foreground">
                    Kaikki kisan erät päivittäin ryhmiteltynä. Kentät: Id, EventId,
                    EventName, BeginDateTimeWithTZ, Category (Track/Field), SubCategory
                    (Sprint/Hurdles/Run/…), Gender, Age, Name, GroupName, Status
                    (Unallocated/Allocated/Progress/Official), CountEnrolled,
                    CountConfirmed, CountAllocated.
                  </p>
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">
                    <code>/competition/&lt;id&gt;/properties</code> – kisan perustiedot
                  </h3>
                  <p className="text-muted-foreground">
                    Kisan nimi ja Id. Periaatteessa myös järjestäjä, paikka ja
                    aikamääreet voivat tulla mukaan, mutta käytössä on lähinnä nimi.
                  </p>
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">
                    <code>/results/&lt;competitionId&gt;/&lt;eventId&gt;</code> – lajin tulokset
                  </h3>
                  <p className="text-muted-foreground">
                    Lajin täydet tulokset kierroksittain ja erittäin (Heats),
                    allokaatioineen (Allocations). Per urheilija: AllocId, Position,
                    Number, TeamName, Name, Firstname, Surname, Organization (Id, Name,
                    NameShort), PB, SB, Result, ResultRank, HeatRank, Wind,
                    NotInCompetition, sekä kenttälajeissa Attempts (yritysrivit).
                    EventCategory, EventSubCategory, EventType (nimi + matka metreinä).
                  </p>
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">Mitä EI ole rajapinnasta saatavilla</h3>
                  <p className="text-muted-foreground">
                    Suoraa endpointtia kaikkien Suomen kisojen listaamiseen ei ole –
                    kisat löydetään Id-haarukoinnilla (harvest-prosessi). Urheilijan
                    kaikki uran tulokset täytyy kerätä yhteen
                    kisa-/tulosvasteista. Henkilötunnukset, syntymäajat tai
                    yhteystiedot eivät ole julkisia.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">Kehitysideoita</h2>
              </div>
              <ul className="list-disc space-y-2 pl-5 text-xs text-muted-foreground">
                <li>
                  <strong className="text-foreground">Kuuluttajan automaattinen "esittely"-teksti:</strong>{" "}
                  luodaan AI:lla 1–2 lauseen intro jokaiselle erälle (urheilijat,
                  ennätykset, kauden kärki) – kuuluttaja vain lukee.
                </li>
                <li>
                  <strong className="text-foreground">Push-ilmoitukset:</strong> seuratut
                  urheilijat → ilmoitus kun erä alkaa, kun tulos on virallinen, tai kun
                  syntyy PB/SB.
                </li>
                <li>
                  <strong className="text-foreground">"Live-tulostaulu" -näyttötila:</strong>{" "}
                  full-screen iso fontti yhdelle erälle, sopii infonäytölle kentälle.
                </li>
                <li>
                  <strong className="text-foreground">Erän ennusteet:</strong> PB/SB-tietojen
                  perusteella todennäköisin järjestys ja "kuka uhkaa kisaennätystä".
                </li>
                <li>
                  <strong className="text-foreground">Kärkilistat per ikäluokka & laji:</strong>{" "}
                  kauden kärki Suomessa kerätyistä tuloksista – jo dataa, vain UI puuttuu.
                </li>
                <li>
                  <strong className="text-foreground">Seurojen vertailu:</strong> kuka on
                  kerännyt eniten PB:itä / sijoja / pisteitä kaudella, vieraskisa-km:t.
                </li>
                <li>
                  <strong className="text-foreground">Urheilijan oma sivu jaettavalla linkillä:</strong>{" "}
                  kauden tulokset, PB-kehitys, tulevat kisat – sopii valmentajan/vanhempien
                  jakamiseen.
                </li>
                <li>
                  <strong className="text-foreground">Aikataulu-konfliktit:</strong>{" "}
                  varoita, jos seurattu urheilija on ilmoitettu kahteen päällekkäiseen
                  lajiin.
                </li>
                <li>
                  <strong className="text-foreground">CSV/Excel-vienti:</strong> kisan
                  tai seuran tulokset analysoitavaksi.
                </li>
                <li>
                  <strong className="text-foreground">"Tänään tapahtuu" -kalenteri:</strong>{" "}
                  valitse seurattavat kisat etukäteen, saat aamulla yhteenvedon päivän
                  ajoista ja urheilijoista.
                </li>
                <li>
                  <strong className="text-foreground">Tuulen ja sään näyttö:</strong>{" "}
                  yhdistetään Wind-kenttä sääpalveluun → "tuuli rajan yli" -merkintä
                  juoksuihin ja pituuksiin.
                </li>
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
