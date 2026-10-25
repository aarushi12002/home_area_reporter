// Short, manually reviewed facts, written in our own words. No listing-site
// copy, ratings, schedules or live POI feed. See docs/free-sources.md.
import additional from "../data/zip-profiles.json" with { type: "json" };
const place = (name, url, postalCode, address) => ({ name, url, postalCode, address });
const transit = (name, url) => ({ name, url, relation: "serves_area" });
const profiles = {
  ...additional.profiles,
  "98101": {
    medical: [place("Virginia Mason Medical Center", "https://www.vmfh.org/our-hospitals/virginia-mason-medical-center", "98101", "1100 9th Ave")],
    area: "Downtown Seattle",
    character: "Downtown shopping, convention venues and light-rail connections.",
    work: [
      place("Seattle Convention Center · Summit", "https://seattlecc.com/", "98101", "900 Pine St"),
      place("Nordstrom Downtown Seattle", "https://www.nordstrom.com/store-details/nordstrom-downtown-seattle", "98101", "500 Pine St"),
    ],
    transport: [transit("Westlake Station · Link light rail", "https://www.soundtransit.org/ride-with-us/stops-stations/westlake-station")],
    shopping: [
      place("H Mart · 2nd & Pine", "https://www.hmartus.com/seattle", "98101", "1601 2nd Ave"),
      place("Nordstrom Downtown Seattle", "https://www.nordstrom.com/store-details/nordstrom-downtown-seattle", "98101", "500 Pine St"),
    ],
  },
  "98102": {
    medical: [place("Swedish Primary Care · Central Seattle", "https://www.swedish.org/locations/central-seattle-primary-care", "98122", "1600 E Jefferson St, Suite 510")],
    area: "Capitol Hill & Eastlake",
    character: "Broadway groceries and light rail, with the Fred Hutch campus nearby.",
    work: [
      place("Seattle Preparatory School", "https://www.seaprep.org/about-prep/contactanddirections", "98102", "2400 11th Ave E"),
      place("Fred Hutch Cancer Center", "https://plannedgiving.fredhutch.org/contact-us/", "98109", "1100 Fairview Ave N"),
    ],
    transport: [transit("Capitol Hill Station · Link light rail", "https://www.soundtransit.org/ride-with-us/stops-stations/capitol-hill-station")],
    shopping: [place("QFC · Broadway Market", "https://www.qfc.com/stores/grocery/st/city/store-name/705/00887", "98102", "417 Broadway E #2")],
  },
  "98103": {
    medical: [place("UW Medicine Primary Care · Fremont", "https://www.uwmedicine.org/locations/primary-care-fremont", "98103", "459 N 35th St, Suite 203")],
    area: "Fremont & Wallingford",
    character: "Tech offices, neighborhood groceries and the Fremont Sunday Market.",
    work: [
      place("Adobe", "https://www.adobe.com/about-adobe/contact/offices.html", "98103", "801 N 34th St"),
      place("Brooks Running", "https://support.brooksrunning.com/hc/en-us/articles/360016209072-Brooks-Running-locations-and-contact-information", "98103", "3400 Stone Way N"),
    ],
    transport: [
      transit("Metro Route 40 · Fremont", "https://kingcounty.gov/en/dept/metro/routes-and-service/schedules-and-maps/schedule?route=040"),
      transit("RapidRide E Line · Aurora", "https://kingcounty.gov/en/dept/metro/routes-and-service/schedules-and-maps/schedule?route=e-line"),
    ],
    shopping: [
      place("PCC · Fremont", "https://www.pcccommunitymarkets.com/stores/fremont/", "98103", "600 N 34th St"),
      place("PCC · Green Lake Aurora", "https://www.pccmarkets.com/stores/greenlake-aurora/", "98103", "7504 Aurora Ave N"),
      place("Fremont Sunday Market", "https://www.fremontmarket.com/getting-here", "98103", "3401 Evanston Ave N / 701 N Northlake Way, seasonal locations"),
    ],
  },
  "98104": {
    medical: [place("Harborview Medical Center", "https://www.uwmedicine.org/locations/harborview-medical-center", "98104", "325 9th Ave")],
    area: "Pioneer Square & Chinatown–International District",
    character: "Downtown offices, Harborview and the Uwajimaya shopping destination.",
    work: [
      place("F5", "https://www.f5.com/company/contact", "98104", "801 5th Ave"),
      place("Harborview Medical Center", "https://www.uwmedicine.org/locations/harborview-medical-center", "98104", "325 9th Ave"),
    ],
    transport: [transit("Pioneer Square Station · Link light rail", "https://www.soundtransit.org/ride-with-us/stops-stations/pioneer-square-station")],
    shopping: [place("Uwajimaya · Seattle", "https://www.uwajimaya.com/visit/", "98104", "600 5th Ave S")],
  },
  "98105": {
    medical: [
      place("Seattle Children’s Hospital", "https://www.seattlechildrens.org/contact/", "98105", "4800 Sand Point Way NE"),
      place("UW Medicine Primary Care · Ravenna", "https://www.uwmedicine.org/locations/primary-care-ravenna", "98105", "4915 25th Ave NE, Suite 300W"),
    ],
    area: "U District & University Village",
    character: "University-area shopping and Seattle Children’s, with UW’s Seattle campus nearby.",
    work: [
      place("Seattle Children’s Hospital", "https://www.seattlechildrens.org/contact/", "98105", "4800 Sand Point Way NE"),
      place("University of Washington · Seattle campus", "https://www.washington.edu/contact/", "98195", "1410 NE Campus Parkway, campus directions address"),
    ],
    transport: [transit("U District Station · Link light rail", "https://www.soundtransit.org/ride-with-us/stops-stations/u-district-station")],
    shopping: [
      place("University Village", "https://uvillage.com/contact-us/", "98105", "2623 NE University Village St"),
      place("Trader Joe’s · U District", "https://locations.traderjoes.com/wa/seattle/", "98105", "4555 Roosevelt Way NE"),
      place("QFC · University Village", "https://www.qfc.com/stores/grocery/st/city/store-name/705/00807", "98105", "2746 NE 45th St"),
    ],
  },
};

const REVIEWED_AT = "2026-10-21";
const REVIEW_UNTIL = "2027-01-19";

export function getZipProfile(zip, { now = new Date() } = {}) {
  if (typeof zip !== "string" || !Object.hasOwn(profiles, zip)) return null;
  const timestamp = new Date(now).getTime();
  const profile = profiles[zip];
  const reviewedAt = profile.reviewedAt || REVIEWED_AT;
  const reviewUntil = profile.reviewUntil || REVIEW_UNTIL;
  // Do not keep calling an old business directory "current" indefinitely.
  if (!Number.isFinite(timestamp) || timestamp < Date.parse(reviewedAt) || timestamp >= Date.parse(reviewUntil)) return null;
  return {
    zip,
    area: profile.area,
    character: profile.character,
    reviewedAt,
    reviewUntil,
    groups: [
      ["work", "Work & institutions"],
      ["transport", "Getting around"],
      ["shopping", "Groceries & shopping"],
      ["medical", "Medical care"],
    ].map(([id, title]) => ({
      id,
      title,
      places: profile[id].map((item) => ({
        ...item,
        relation: item.relation || (item.postalCode === zip ? "in_zip" : "nearby"),
      })),
    })),
  };
}
