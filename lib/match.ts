// lib/match.ts
// Filename-to-photo matching logic.
// Match is case-insensitive and extension-flexible — match on filename stem only.
// Real department CSVs mix .jpg/.jpeg/.png casing, so exact-string matching is forbidden.

export interface MatchResult {
  /** RegNo or photo filename stem from CSV */
  csvStem: string;
  /** Original Photo field value from CSV */
  csvPhotoField: string;
  /** Matched uploaded file name, or null if no match */
  matchedFileName: string | null;
  /** Matched file object, or null */
  matchedFile: File | null;
}

/**
 * Extract the stem (filename without extension) from a filename string.
 * e.g. "RA2311004010497.jpeg" → "ra2311004010497"
 *      "RA2311004010497"      → "ra2311004010497"
 */
export function toStem(filename: string): string {
  return filename
    .trim()
    .replace(/\.[^.]+$/, "") // remove last extension if present
    .toLowerCase();
}

/**
 * Build a match map: for each student's Photo field, find the best-matching
 * uploaded file. Returns a map of RegNo → MatchResult.
 *
 * Matching priority:
 * 1. Stem of the Photo field value matches stem of an uploaded filename
 * 2. Stem of the RegNo matches stem of an uploaded filename
 */
export function matchPhotos(
  students: { RegNo: string; Photo: string }[],
  uploadedFiles: File[]
): Map<string, MatchResult> {
  // Build a lookup: stem → File (from uploaded files)
  const stemToFile = new Map<string, File>();
  for (const file of uploadedFiles) {
    const stem = toStem(file.name);
    stemToFile.set(stem, file);
  }

  const results = new Map<string, MatchResult>();

  for (const student of students) {
    const photoStem = toStem(student.Photo);
    const regNoStem = toStem(student.RegNo);

    // Try photo stem first, then RegNo stem
    let matchedFile: File | null =
      stemToFile.get(photoStem) ?? stemToFile.get(regNoStem) ?? null;

    results.set(student.RegNo, {
      csvStem: photoStem || regNoStem,
      csvPhotoField: student.Photo,
      matchedFileName: matchedFile?.name ?? null,
      matchedFile,
    });
  }

  return results;
}

/**
 * Classify match results into matched and unmatched lists.
 */
export function classifyMatches(matchMap: Map<string, MatchResult>): {
  matched: string[];
  unmatched: string[];
} {
  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const [regNo, result] of matchMap.entries()) {
    if (result.matchedFile) {
      matched.push(regNo);
    } else {
      unmatched.push(regNo);
    }
  }

  return { matched, unmatched };
}
