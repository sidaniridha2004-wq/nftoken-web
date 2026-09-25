import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { createExtractorFromData } from "node-unrar-js";

const COOKIE_KEYS = ["NetflixId", "SecureNetflixId", "nfvdid", "OptanonConsent"];

function decodeCookieValue(v) {
  if (v.includes("%")) { try { return decodeURIComponent(v); } catch { return v; } }
  return v;
}
function extractCookieDict(text) {
  const d = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split("\t");
    if (parts.length >= 7) d[parts[5]] = parts[6];
  }
  for (const key of COOKIE_KEYS) {
    if (key in d) continue;
    const m = text.match(new RegExp("(?:^|[^A-Za-z0-9_])" + key + "=([^;,\\s]+)"));
    if (m) d[key] = decodeCookieValue(m[1]);
  }
  return d;
}
function toCookieString(dict) {
  return COOKIE_KEYS.filter((k) => dict[k]).map((k) => `${k}=${dict[k]}`).join("; ");
}

// ZIP
const zipBuf = readFileSync("Netflix_Hits.zip");
const files = unzipSync(new Uint8Array(zipBuf));
let zipCookies = [];
for (const [name, data] of Object.entries(files)) {
  if (!name.toLowerCase().endsWith(".txt")) continue;
  const dict = extractCookieDict(strFromU8(data));
  if (dict.NetflixId) zipCookies.push({ name, cookie: toCookieString(dict) });
}
console.log("ZIP txt entries with NetflixId:", zipCookies.length);
console.log("sample:", zipCookies[0]?.name, zipCookies[0]?.cookie.slice(0, 60) + "...");

// RAR5
const rarBuf = readFileSync("Netflix.rar");
const ab = rarBuf.buffer.slice(rarBuf.byteOffset, rarBuf.byteOffset + rarBuf.byteLength);
const extractor = await createExtractorFromData({ data: ab });
const extracted = extractor.extract({});
const list = [...extracted.files];
let rarCookies = [];
let rarNames = [];
for (const f of list) {
  if (f.fileHeader.flags.directory) continue;
  rarNames.push(f.fileHeader.name);
  const content = f.extraction ? strFromU8(f.extraction) : "";
  const dict = extractCookieDict(content);
  if (dict.NetflixId) rarCookies.push({ name: f.fileHeader.name, cookie: toCookieString(dict) });
}
console.log("RAR files:", rarNames.length, "first names:", rarNames.slice(0, 3));
console.log("RAR entries with NetflixId:", rarCookies.length);
console.log("sample:", rarCookies[0]?.name, rarCookies[0]?.cookie.slice(0, 60) + "...");
