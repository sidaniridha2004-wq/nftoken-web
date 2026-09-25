// Detects the country a Netflix cookie dump came from, using the metadata that
// exported .txt files commonly include (e.g. a "Country: US" header line, or a
// geolocation hint embedded in the OptanonConsent cookie). This is pure string
// parsing: no network calls and nothing that depends on a live Netflix session.

/** ISO 3166-1 alpha-2 code -> English short country name (ASCII only). */
export const ISO_COUNTRIES: Record<string, string> = {
  AD: "Andorra",
  AE: "United Arab Emirates",
  AF: "Afghanistan",
  AG: "Antigua and Barbuda",
  AI: "Anguilla",
  AL: "Albania",
  AM: "Armenia",
  AO: "Angola",
  AQ: "Antarctica",
  AR: "Argentina",
  AS: "American Samoa",
  AT: "Austria",
  AU: "Australia",
  AW: "Aruba",
  AX: "Aland Islands",
  AZ: "Azerbaijan",
  BA: "Bosnia and Herzegovina",
  BB: "Barbados",
  BD: "Bangladesh",
  BE: "Belgium",
  BF: "Burkina Faso",
  BG: "Bulgaria",
  BH: "Bahrain",
  BI: "Burundi",
  BJ: "Benin",
  BL: "Saint Barthelemy",
  BM: "Bermuda",
  BN: "Brunei",
  BO: "Bolivia",
  BQ: "Bonaire, Sint Eustatius and Saba",
  BR: "Brazil",
  BS: "Bahamas",
  BT: "Bhutan",
  BV: "Bouvet Island",
  BW: "Botswana",
  BY: "Belarus",
  BZ: "Belize",
  CA: "Canada",
  CC: "Cocos (Keeling) Islands",
  CD: "Democratic Republic of the Congo",
  CF: "Central African Republic",
  CG: "Congo",
  CH: "Switzerland",
  CI: "Cote d'Ivoire",
  CK: "Cook Islands",
  CL: "Chile",
  CM: "Cameroon",
  CN: "China",
  CO: "Colombia",
  CR: "Costa Rica",
  CU: "Cuba",
  CV: "Cabo Verde",
  CW: "Curacao",
  CX: "Christmas Island",
  CY: "Cyprus",
  CZ: "Czechia",
  DE: "Germany",
  DJ: "Djibouti",
  DK: "Denmark",
  DM: "Dominica",
  DO: "Dominican Republic",
  DZ: "Algeria",
  EC: "Ecuador",
  EE: "Estonia",
  EG: "Egypt",
  EH: "Western Sahara",
  ER: "Eritrea",
  ES: "Spain",
  ET: "Ethiopia",
  FI: "Finland",
  FJ: "Fiji",
  FK: "Falkland Islands",
  FM: "Micronesia",
  FO: "Faroe Islands",
  FR: "France",
  GA: "Gabon",
  GB: "United Kingdom",
  GD: "Grenada",
  GE: "Georgia",
  GF: "French Guiana",
  GG: "Guernsey",
  GH: "Ghana",
  GI: "Gibraltar",
  GL: "Greenland",
  GM: "Gambia",
  GN: "Guinea",
  GP: "Guadeloupe",
  GQ: "Equatorial Guinea",
  GR: "Greece",
  GS: "South Georgia and the South Sandwich Islands",
  GT: "Guatemala",
  GU: "Guam",
  GW: "Guinea-Bissau",
  GY: "Guyana",
  HK: "Hong Kong",
  HM: "Heard Island and McDonald Islands",
  HN: "Honduras",
  HR: "Croatia",
  HT: "Haiti",
  HU: "Hungary",
  ID: "Indonesia",
  IE: "Ireland",
  IL: "Israel",
  IM: "Isle of Man",
  IN: "India",
  IO: "British Indian Ocean Territory",
  IQ: "Iraq",
  IR: "Iran",
  IS: "Iceland",
  IT: "Italy",
  JE: "Jersey",
  JM: "Jamaica",
  JO: "Jordan",
  JP: "Japan",
  KE: "Kenya",
  KG: "Kyrgyzstan",
  KH: "Cambodia",
  KI: "Kiribati",
  KM: "Comoros",
  KN: "Saint Kitts and Nevis",
  KP: "North Korea",
  KR: "South Korea",
  KW: "Kuwait",
  KY: "Cayman Islands",
  KZ: "Kazakhstan",
  LA: "Laos",
  LB: "Lebanon",
  LC: "Saint Lucia",
  LI: "Liechtenstein",
  LK: "Sri Lanka",
  LR: "Liberia",
  LS: "Lesotho",
  LT: "Lithuania",
  LU: "Luxembourg",
  LV: "Latvia",
  LY: "Libya",
  MA: "Morocco",
  MC: "Monaco",
  MD: "Moldova",
  ME: "Montenegro",
  MF: "Saint Martin",
  MG: "Madagascar",
  MH: "Marshall Islands",
  MK: "North Macedonia",
  ML: "Mali",
  MM: "Myanmar",
  MN: "Mongolia",
  MO: "Macao",
  MP: "Northern Mariana Islands",
  MQ: "Martinique",
  MR: "Mauritania",
  MS: "Montserrat",
  MT: "Malta",
  MU: "Mauritius",
  MV: "Maldives",
  MW: "Malawi",
  MX: "Mexico",
  MY: "Malaysia",
  MZ: "Mozambique",
  NA: "Namibia",
  NC: "New Caledonia",
  NE: "Niger",
  NF: "Norfolk Island",
  NG: "Nigeria",
  NI: "Nicaragua",
  NL: "Netherlands",
  NO: "Norway",
  NP: "Nepal",
  NR: "Nauru",
  NU: "Niue",
  NZ: "New Zealand",
  OM: "Oman",
  PA: "Panama",
  PE: "Peru",
  PF: "French Polynesia",
  PG: "Papua New Guinea",
  PH: "Philippines",
  PK: "Pakistan",
  PL: "Poland",
  PM: "Saint Pierre and Miquelon",
  PN: "Pitcairn",
  PR: "Puerto Rico",
  PS: "Palestine",
  PT: "Portugal",
  PW: "Palau",
  PY: "Paraguay",
  QA: "Qatar",
  RE: "Reunion",
  RO: "Romania",
  RS: "Serbia",
  RU: "Russia",
  RW: "Rwanda",
  SA: "Saudi Arabia",
  SB: "Solomon Islands",
  SC: "Seychelles",
  SD: "Sudan",
  SE: "Sweden",
  SG: "Singapore",
  SH: "Saint Helena, Ascension and Tristan da Cunha",
  SI: "Slovenia",
  SJ: "Svalbard and Jan Mayen",
  SK: "Slovakia",
  SL: "Sierra Leone",
  SM: "San Marino",
  SN: "Senegal",
  SO: "Somalia",
  SR: "Suriname",
  SS: "South Sudan",
  ST: "Sao Tome and Principe",
  SV: "El Salvador",
  SX: "Sint Maarten",
  SY: "Syria",
  SZ: "Eswatini",
  TC: "Turks and Caicos Islands",
  TD: "Chad",
  TF: "French Southern Territories",
  TG: "Togo",
  TH: "Thailand",
  TJ: "Tajikistan",
  TK: "Tokelau",
  TL: "Timor-Leste",
  TM: "Turkmenistan",
  TN: "Tunisia",
  TO: "Tonga",
  TR: "Turkiye",
  TT: "Trinidad and Tobago",
  TV: "Tuvalu",
  TW: "Taiwan",
  TZ: "Tanzania",
  UA: "Ukraine",
  UG: "Uganda",
  UM: "United States Minor Outlying Islands",
  US: "United States",
  UY: "Uruguay",
  UZ: "Uzbekistan",
  VA: "Vatican City",
  VC: "Saint Vincent and the Grenadines",
  VE: "Venezuela",
  VG: "British Virgin Islands",
  VI: "U.S. Virgin Islands",
  VN: "Vietnam",
  VU: "Vanuatu",
  WF: "Wallis and Futuna",
  WS: "Samoa",
  YE: "Yemen",
  YT: "Mayotte",
  ZA: "South Africa",
  ZM: "Zambia",
  ZW: "Zimbabwe",
};

/** Extra spellings and common aliases that map onto an ISO code. */
const ALIASES: Record<string, string> = {
  usa: "US",
  "u s a": "US",
  "u s": "US",
  "united states of america": "US",
  america: "US",
  uk: "GB",
  "u k": "GB",
  "great britain": "GB",
  britain: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  "south korea": "KR",
  korea: "KR",
  "republic of korea": "KR",
  "north korea": "KP",
  "democratic peoples republic of korea": "KP",
  russia: "RU",
  "russian federation": "RU",
  "czech republic": "CZ",
  "the netherlands": "NL",
  holland: "NL",
  uae: "AE",
  "united arab emirates": "AE",
  "hong kong sar": "HK",
  "macau": "MO",
  "macao sar": "MO",
  "ivory coast": "CI",
  turkey: "TR",
  "viet nam": "VN",
  "republic of ireland": "IE",
  "republic of moldova": "MD",
  "bolivia plurinational state of": "BO",
  "venezuela bolivarian republic of": "VE",
  "iran islamic republic of": "IR",
  "syrian arab republic": "SY",
  "lao peoples democratic republic": "LA",
  "brunei darussalam": "BN",
  "cape verde": "CV",
  swaziland: "SZ",
  "republic of north macedonia": "MK",
  macedonia: "MK",
  "tanzania united republic of": "TZ",
  "state of palestine": "PS",
  "palestinian territory": "PS",
  "vatican": "VA",
  "holy see": "VA",
  "east timor": "TL",
  "congo kinshasa": "CD",
  "dr congo": "CD",
  "congo brazzaville": "CG",
  "republic of the congo": "CG",
};

/** A resolved country: `code` is null when only a name (unmapped) is known. */
export type DetectedCountry = {
  code: string | null;
  name: string;
  flag: string;
};

/**
 * Normalize a free-text value for lookup: strip accents/diacritics, lowercase,
 * drop punctuation, and collapse whitespace.
 */
export function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build a flag emoji from a 2-letter code using regional indicators. */
export function flagEmoji(code: string): string {
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  const base = 0x1f1e6; // regional indicator symbol letter A
  return String.fromCodePoint(
    base + (cc.charCodeAt(0) - 65),
    base + (cc.charCodeAt(1) - 65),
  );
}

/** Reverse lookup: normalized country name / alias -> ISO code. */
const NAME_TO_CODE: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [code, name] of Object.entries(ISO_COUNTRIES)) {
    map[normalize(name)] = code;
  }
  for (const [alias, code] of Object.entries(ALIASES)) {
    map[normalize(alias)] = code;
  }
  return map;
})();

/** Resolve from an ISO alpha-2 code. Returns null for unknown codes. */
export function fromCode(raw: string): DetectedCountry | null {
  const code = raw.trim().toUpperCase();
  const name = ISO_COUNTRIES[code];
  if (!name) return null;
  return { code, name, flag: flagEmoji(code) };
}

/** Resolve from a country name or known alias. Returns null if unmapped. */
export function fromName(raw: string): DetectedCountry | null {
  const key = normalize(raw);
  if (!key) return null;
  const code = NAME_TO_CODE[key];
  if (!code) return null;
  return { code, name: ISO_COUNTRIES[code], flag: flagEmoji(code) };
}

/**
 * Interpret a single metadata value into a country. Handles a bare 2-letter
 * code, a full name, a name with a trailing "(US)" code, or a leading code such
 * as "US - United States". Only the first pipe/semicolon segment is considered.
 */
export function interpret(rawValue: string): DetectedCountry | null {
  let value = rawValue.trim();
  if (!value) return null;
  value = value.split(/[|;]/)[0].trim();

  // Trailing parenthetical code, e.g. "United States (US)".
  const paren = value.match(/\(([A-Za-z]{2})\)\s*$/);
  if (paren) {
    const byParen = fromCode(paren[1]);
    if (byParen) return byParen;
  }

  const withoutParen = value.replace(/\s*\([^)]*\)\s*$/, "").trim();

  // Bare 2-letter code.
  if (/^[A-Za-z]{2}$/.test(withoutParen)) {
    const byCode = fromCode(withoutParen);
    if (byCode) return byCode;
  }

  // Full name or known alias.
  const byName = fromName(withoutParen);
  if (byName) return byName;

  // Leading 2-letter code followed by a word boundary, e.g. "US United States".
  const lead = withoutParen.match(/^([A-Za-z]{2})\b/);
  if (lead) {
    const byLead = fromCode(lead[1]);
    if (byLead) return byLead;
  }

  return null;
}

/** Metadata keys (normalized) understood to carry a country value. */
const COUNTRY_LABELS = new Set([
  "country",
  "country code",
  "countrycode",
  "country name",
  "countryname",
  "country of signup",
  "countryofsignup",
  "signup country",
  "signupcountry",
  "registration country",
  "registrationcountry",
  "reg country",
  "regcountry",
  "geo",
  "geo country",
  "geolocation",
  "region",
  "pais", // es / pt
  "land", // de / nl
  "pays", // fr
  "paese", // it
]);

/**
 * Scan cookie-dump text for the country of origin.
 *
 * Precedence:
 *   1. An explicit metadata line such as "Country: US".
 *   2. Netflix's countryOfSignup value if present inline.
 *   3. A geolocation=CC hint inside the OptanonConsent cookie.
 */
export function detectCountry(text: string): DetectedCountry | null {
  if (!text) return null;

  // 1) Explicit metadata lines: "Key: Value", "Key = Value", "Key | Value",
  //    or "Key - Value" (the dash form requires surrounding spaces so that
  //    hyphenated names such as "Guinea-Bissau" are never split).
  for (const line of text.split(/\r?\n/)) {
    const m =
      line.match(/^\s*([A-Za-z][A-Za-z _-]*?)\s*[:=|]\s*(.+?)\s*$/) ||
      line.match(/^\s*([A-Za-z][A-Za-z ]*?)\s+-\s+(.+?)\s*$/);
    if (!m) continue;
    const key = normalize(m[1]);
    if (!COUNTRY_LABELS.has(key)) continue;
    const found = interpret(m[2]);
    if (found) return found;
  }

  // 2) Netflix countryOfSignup (appears in some JSON / header exports).
  const signup = text.match(/countryOfSignup["'=:\s]+([A-Za-z]{2})\b/i);
  if (signup) {
    const found = fromCode(signup[1]);
    if (found) return found;
  }

  // 3) OptanonConsent geolocation hint, e.g. "...geolocation=CA;...".
  const geo = text.match(/geolocation=([A-Za-z]{2})\b/i);
  if (geo) {
    const found = fromCode(geo[1]);
    if (found) return found;
  }

  return null;
}

/** Human-readable display: "<flag> <name>", or just the name if no flag. */
export function toDisplay(country: DetectedCountry): string {
  return country.flag ? `${country.flag} ${country.name}` : country.name;
}

/** Convenience: detect and format in one call. Returns null if not found. */
export function detectCountryLabel(text: string): string | null {
  const country = detectCountry(text);
  return country ? toDisplay(country) : null;
}
