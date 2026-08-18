// lib/validate.ts
// CSV validation logic — pure function, no I/O.
// Must run before generation and must block on any error.

export interface StudentRow {
  RegNo: string;
  Name: string;
  Course: string;
  Branch: string;
  Company: string;
  OfferCategory: string;
  Photo: string;
}

export interface ValidationError {
  row: number; // 1-indexed, matching CSV row (header = 0)
  regNo?: string;
  field?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  students: StudentRow[];
  errors: ValidationError[];
}

const REQUIRED_COLUMNS = [
  "RegNo",
  "Name",
  "Course",
  "Branch",
  "Company",
  "OfferCategory",
  "Photo",
] as const;

const REQUIRED_FIELDS: (keyof StudentRow)[] = [
  "Name",
  "RegNo",
  "Company",
  "Photo",
];

export function validateCSV(rawRows: Record<string, string>[]): ValidationResult {
  const errors: ValidationError[] = [];
  const students: StudentRow[] = [];

  // --- Column presence check ---
  if (rawRows.length === 0) {
    return {
      valid: false,
      students: [],
      errors: [{ row: 0, message: "CSV is empty or has no data rows." }],
    };
  }

  const presentColumns = Object.keys(rawRows[0]);
  const missingColumns = REQUIRED_COLUMNS.filter(
    (col) => !presentColumns.includes(col)
  );

  if (missingColumns.length > 0) {
    return {
      valid: false,
      students: [],
      errors: [
        {
          row: 0,
          message: `Missing required columns: ${missingColumns.join(", ")}`,
        },
      ],
    };
  }

  // --- Per-row validation ---
  const seenRegNos = new Map<string, number>(); // RegNo → first seen row

  rawRows.forEach((raw, idx) => {
    const rowNum = idx + 2; // 1-indexed, header is row 1
    const row = raw as unknown as StudentRow;

    // Required field check
    for (const field of REQUIRED_FIELDS) {
      const val = (row[field] ?? "").trim();
      if (!val) {
        errors.push({
          row: rowNum,
          regNo: row.RegNo || undefined,
          field,
          message: `Row ${rowNum}: Missing required field "${field}"`,
        });
      }
    }

    // Duplicate RegNo check
    const regNo = (row.RegNo ?? "").trim();
    if (regNo) {
      if (seenRegNos.has(regNo)) {
        errors.push({
          row: rowNum,
          regNo,
          field: "RegNo",
          message: `Row ${rowNum}: Duplicate RegNo "${regNo}" (first seen at row ${seenRegNos.get(regNo)})`,
        });
      } else {
        seenRegNos.set(regNo, rowNum);
      }
    }

    // Collect valid student (even if it has errors — UI needs the data)
    students.push({
      RegNo: (row.RegNo ?? "").trim(),
      Name: (row.Name ?? "").trim(),
      Course: (row.Course ?? "").trim(),
      Branch: (row.Branch ?? "").trim(),
      Company: (row.Company ?? "").trim(),
      OfferCategory: (row.OfferCategory ?? "").trim(),
      Photo: (row.Photo ?? "").trim(),
    });
  });

  return {
    valid: errors.length === 0,
    students,
    errors,
  };
}
