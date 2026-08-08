export interface VolunteerTemplate {
  name: string;
  description: string;
  needed_count: number;
}

/** Valmiit talkooryhmäpohjat kilpailun järjestelytehtäviin. */
export const VOLUNTEER_TEMPLATES: VolunteerTemplate[] = [
  {
    name: "Aitaryhmä",
    description: "Aitojen siirto ja asettelu juoksulajeihin aikataulun mukaan.",
    needed_count: 4,
  },
  {
    name: "Kahvio",
    description: "Kahvion myynti, täydennys ja siisteys.",
    needed_count: 4,
  },
  {
    name: "Tekninen ryhmä",
    description: "Äänentoisto, sähköt ja välineiden huolto.",
    needed_count: 2,
  },
  {
    name: "Tulospalvelu",
    description: "Tulosten kirjaus ja tulostus.",
    needed_count: 2,
  },
  {
    name: "Liikenteenohjaus",
    description: "Pysäköinnin ohjaus ja opastus.",
    needed_count: 3,
  },
  {
    name: "Pystytys",
    description: "Kilpailupaikkojen rakentaminen ennen kisaa.",
    needed_count: 6,
  },
  {
    name: "Purku",
    description: "Välineiden purku ja varastointi kisan jälkeen.",
    needed_count: 6,
  },
  {
    name: "Kuulutus",
    description: "Kuuluttajan avustaminen ja tiedottaminen.",
    needed_count: 1,
  },
  {
    name: "Ensiapu",
    description: "Ensiapupiste kilpailualueella.",
    needed_count: 1,
  },
  {
    name: "Lähtöjen avustaminen",
    description: "Kilpailijoiden kokoaminen ja lähtöpaikalle ohjaus.",
    needed_count: 2,
  },
];
