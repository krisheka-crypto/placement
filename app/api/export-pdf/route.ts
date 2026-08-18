// app/api/export-pdf/route.ts
// Accepts an array of base64 PNG poster images and returns a PDF stream.
// Uses pdf-lib to embed each PNG as a page at the template's native dimensions.

import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";

export interface ExportPdfRequestBody {
  posters: string[]; // base64 PNG strings (no data URI prefix)
  canvasWidth: number;
  canvasHeight: number;
  dpi?: number; // default 300
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ExportPdfRequestBody;
    const { posters, canvasWidth, canvasHeight, dpi = 300 } = body;

    if (!posters || posters.length === 0) {
      return NextResponse.json({ error: "No posters provided" }, { status: 400 });
    }

    const pdfDoc = await PDFDocument.create();

    // Convert pixel dimensions to PDF points (1 point = 1/72 inch)
    // At 300 DPI: points = pixels * 72 / 300
    const ptsPerPx = 72 / dpi;
    const pageWidth = canvasWidth * ptsPerPx;
    const pageHeight = canvasHeight * ptsPerPx;

    for (const base64 of posters) {
      const pngBytes = Buffer.from(base64, "base64");
      const pngImage = await pdfDoc.embedPng(pngBytes);
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });
    }

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="placement-posters.pdf"',
        "Content-Length": pdfBytes.byteLength.toString(),
      },
    });
  } catch (err) {
    console.error("[export-pdf] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
