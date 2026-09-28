// lib/render.ts
// Sharp-based poster compositing engine.
// Template-config-driven — never hardcode slot positions or template names here.
// Called from the API route; returns PNG buffer(s).

import sharp, { OverlayOptions } from "sharp";
import path from "path";
import fs from "fs";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SlotConfig {
  id: number;
  row: number;
  col: number;
  photo: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  text: {
    centerX: number;
    startY: number;
    maxWidth: number;
  };
}

export interface TextColors {
  name: string;
  regNo: string;
  courseBranch: string;
  company: string;
  offerCategory: string;
}

export interface FontSizes {
  name: number;
  regNo: number;
  courseBranch: number;
  company: number;
  offerCategory: number;
  minimum: number;
}

export interface TemplateConfig {
  templateName: string;
  templateImage: string;
  canvasWidth: number;
  canvasHeight: number;
  slotsPerPoster: number;
  textColors: TextColors;
  fontSizes: FontSizes;
  lineSpacing: number;
  slots: SlotConfig[];
}

export interface StudentForRender {
  RegNo: string;
  Name: string;
  Course: string;
  Branch: string;
  Company: string;
  OfferCategory: string;
  photoBuffer: Buffer; // already-fetched and decoded photo
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Approximate text width in pixels at a given font size.
 * Uses a heuristic (avg char width ≈ fontSize * 0.55 for bold, 0.5 for regular).
 * Good enough for clamping to slot width; we don't have a canvas env server-side.
 */
function estimateTextWidth(
  text: string,
  fontSize: number,
  bold = false
): number {
  const charWidthFactor = bold ? 0.58 : 0.52;

  return text.length * fontSize * charWidthFactor;
}

/**
 * Determine the effective font size for a line of text given a max width.
 * Shrinks from defaultSize down to minimum in steps of 1.
 */
function effectiveFontSize(
  text: string,
  defaultSize: number,
  minSize: number,
  maxWidth: number,
  bold = false
): number {
  let size = defaultSize;

  while (
    size > minSize &&
    estimateTextWidth(text, size, bold) > maxWidth
  ) {
    size -= 1;
  }

  return size;
}

/**
 * Build an SVG text element centered on cx at y, with the given style.
 */
function svgTextLine(
  text: string,
  cx: number,
  y: number,
  fontSize: number,
  color: string,
  bold: boolean
): string {
  const weight = bold ? "bold" : "normal";

  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return `<text x="${cx}" y="${y}" text-anchor="middle" font-family="DejaVu Sans" font-size="${fontSize}" font-weight="${weight}" fill="${color}">${escaped}</text>`;
}

/**
 * Build the full SVG overlay for all occupied slots.
 * Returns an SVG string sized to the full canvas.
 */
function buildTextOverlaySVG(
  students: StudentForRender[],
  slots: SlotConfig[],
  config: TemplateConfig
): string {
  const {
    canvasWidth,
    canvasHeight,
    textColors,
    fontSizes,
    lineSpacing,
  } = config;

  const lines: string[] = [];

  students.forEach((student, i) => {
    const slot = slots[i];

    if (!slot) return;

    const {
      centerX,
      startY,
      maxWidth,
    } = slot.text;

    const { minimum } = fontSizes;

    // ── Line 1: Name — bold, red ────────────────────────────────────────

    const nameFontSize = effectiveFontSize(
      student.Name,
      fontSizes.name,
      minimum,
      maxWidth,
      true
    );

    lines.push(
      svgTextLine(
        student.Name,
        centerX,
        startY,
        nameFontSize,
        textColors.name,
        true
      )
    );

    // ── Line 2: Registration Number — bold, red ─────────────────────────

    const regNoText = `(${student.RegNo})`;

    const regNoFontSize = effectiveFontSize(
      regNoText,
      fontSizes.regNo,
      minimum,
      maxWidth,
      true
    );

    lines.push(
      svgTextLine(
        regNoText,
        centerX,
        startY + lineSpacing,
        regNoFontSize,
        textColors.regNo,
        true
      )
    );

    // ── Line 3: Course + Branch — regular, black ─────────────────────────

    const courseBranchText = `${student.Course} - ${student.Branch}`;

    const cbFontSize = effectiveFontSize(
      courseBranchText,
      fontSizes.courseBranch,
      minimum,
      maxWidth,
      false
    );

    lines.push(
      svgTextLine(
        courseBranchText,
        centerX,
        startY + lineSpacing * 2,
        cbFontSize,
        textColors.courseBranch,
        false
      )
    );

    // ── Line 4: Company — bold, blue ────────────────────────────────────

    const companyFontSize = effectiveFontSize(
      student.Company,
      fontSizes.company,
      minimum,
      maxWidth,
      true
    );

    lines.push(
      svgTextLine(
        student.Company,
        centerX,
        startY + lineSpacing * 3,
        companyFontSize,
        textColors.company,
        true
      )
    );

    // ── Line 5: Offer Category — regular, black ─────────────────────────

    const offerFontSize = effectiveFontSize(
      student.OfferCategory,
      fontSizes.offerCategory,
      minimum,
      maxWidth,
      false
    );

    lines.push(
      svgTextLine(
        student.OfferCategory,
        centerX,
        startY + lineSpacing * 4,
        offerFontSize,
        textColors.offerCategory,
        false
      )
    );
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}">${lines.join(
    ""
  )}</svg>`;
}

// ─── Main render function ─────────────────────────────────────────────────────

/**
 * Render a single poster page for up to slotsPerPoster students.
 * Returns a PNG buffer at the template's native resolution.
 *
 * @param students Slice of students for this poster
 * @param templateConfig Loaded template config JSON
 * @param templateImagePath Absolute path to the template PNG on disk
 */
export async function renderPoster(
  students: StudentForRender[],
  templateConfig: TemplateConfig,
  templateImagePath: string
): Promise<Buffer> {
  const {
    canvasWidth,
    canvasHeight,
    slots,
  } = templateConfig;

  // Start with the template background
  let composite = sharp(templateImagePath).ensureAlpha();

  // Composite layers: collect all operations
  const compositeOps: OverlayOptions[] = [];

  // ── Photo slots ────────────────────────────────────────────────────────

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const slot = slots[i];

    if (!slot) continue;

    const {
      x,
      y,
      width,
      height,
    } = slot.photo;

    /*
     * The photo slot represents the OUTER blue rectangle.
     *
     * The uploaded photo is deliberately made slightly smaller
     * so that the blue border from the template remains visible.
     */

    // Amount of blue border to preserve on each side.
    const padding = 6;

    // Inner photo dimensions.
    const photoWidth = Math.max(
      1,
      width - padding * 2
    );

    const photoHeight = Math.max(
      1,
      height - padding * 2
    );

    /*
     * Standardize EVERY uploaded photo to exactly the same
     * dimensions.
     *
     * rotate()
     *     Corrects photos taken on phones where the orientation
     *     is stored in EXIF metadata.
     *
     * fit: "cover"
     *     Maintains aspect ratio.
     *     Fills the complete photo area.
     *     Crops excess instead of stretching the image.
     *
     * position: "center"
     *     Centers the crop so different uploaded photos have
     *     more consistent framing.
     */

    const resizedPhoto = await sharp(student.photoBuffer)
      .rotate()
      .resize(photoWidth, photoHeight, {
        fit: "cover",
        position: "center",
      })
      .png()
      .toBuffer();

    /*
     * Place the photo inside the blue rectangle.
     *
     * The padding is added to x and y so the photo does not
     * cover the blue border.
     */

    compositeOps.push({
      input: resizedPhoto,
      left: x + padding,
      top: y + padding,
    });
  }

  // ── Text overlay (single SVG over the whole canvas) ──────────────────────

  const svgText = buildTextOverlaySVG(
    students,
    slots,
    templateConfig
  );

  compositeOps.push({
    input: Buffer.from(svgText),
    top: 0,
    left: 0,
  });

  // ── Apply all composites at once ─────────────────────────────────────────

  const outputBuffer = await composite
    .composite(compositeOps)
    .png({
      compressionLevel: 6,
    })
    .toBuffer();

  return outputBuffer;
}

// ─── Template configuration loader ───────────────────────────────────────────

/**
 * Load a template config from disk by name.
 */
export function loadTemplateConfig(
  templateName: string
): TemplateConfig {
  const configPath = path.join(
    process.cwd(),
    "config",
    "templates",
    `${templateName}.json`
  );

  const raw = fs.readFileSync(
    configPath,
    "utf-8"
  );

  return JSON.parse(raw) as TemplateConfig;
}