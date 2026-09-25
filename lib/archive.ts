import { unzipSync, strFromU8 } from "fflate";
import { extractCookieDict, serializeCookieDict } from "./cookies";

export type ExtractedCookie = {
  /** Path of the entry inside the archive. */
  source: string;
  /** Rebuilt cookie header string (NetflixId=...; ...). */
  cookie: string;
  /** A friendly label (email if present, else the file name). */
  label: string;
};

const TEXT_RE = /\.(txt|json|text|log|csv)$/i;

function looksTextual(name: string): boolean {
  const base = name.split("/").pop() || name;
  // Accept known text extensions, or extension-less files (some dumps omit it).
  return TEXT_RE.test(base) || !base.includes(".");
}

function labelFor(source: string, text: string): string {
  const email = text.match(/Email:\s*([^\s]+@[^\s]+)/i)?.[1];
  if (email) return email;
  const base = source.split("/").pop() || source;
  return base.replace(/\.[^.]+$/, "");
}

function collect(
  out: ExtractedCookie[],
  seen: Set<string>,
  source: string,
  text: string,
): void {
  const dict = extractCookieDict(text);
  const netflixId = dict["NetflixId"];
  if (!netflixId) return;
  if (seen.has(netflixId)) return;
  seen.add(netflixId);
  out.push({ source, cookie: serializeCookieDict(dict), label: labelFor(source, text) });
}

export type ArchiveKind = "zip" | "rar";

export function detectArchive(bytes: Uint8Array): ArchiveKind | null {
  // ZIP: "PK\x03\x04" (also PK\x05\x06 empty, PK\x07\x08 spanned)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "zip";
  // RAR: "Rar!\x1a\x07" (both RAR4 and RAR5)
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x61 &&
    bytes[2] === 0x72 &&
    bytes[3] === 0x21
  ) {
    return "rar";
  }
  return null;
}

/**
 * Extract Netflix cookies from a .zip or .rar archive of text files.
 * De-duplicates by NetflixId value. Throws on an unsupported format.
 */
export async function extractCookiesFromArchive(
  data: ArrayBuffer,
): Promise<ExtractedCookie[]> {
  const bytes = new Uint8Array(data);
  const kind = detectArchive(bytes);
  const out: ExtractedCookie[] = [];
  const seen = new Set<string>();

  if (kind === "zip") {
    const files = unzipSync(bytes);
    for (const [name, content] of Object.entries(files)) {
      if (name.endsWith("/") || content.length === 0) continue;
      if (!looksTextual(name)) continue;
      collect(out, seen, name, strFromU8(content));
    }
  } else if (kind === "rar") {
    // Imported lazily so the WASM only loads when a RAR is actually processed.
    const { createExtractorFromData } = await import("node-unrar-js");
    const extractor = await createExtractorFromData({ data });
    const extracted = extractor.extract({});
    for (const file of extracted.files) {
      if (file.fileHeader.flags.directory) continue;
      if (!file.extraction) continue;
      if (!looksTextual(file.fileHeader.name)) continue;
      collect(out, seen, file.fileHeader.name, strFromU8(file.extraction));
    }
  } else {
    throw new Error("Unsupported file. Please upload a .zip or .rar archive.");
  }

  return out;
}
