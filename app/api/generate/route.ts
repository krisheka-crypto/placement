// app/api/generate/route.ts
// Accepts student data + photo blobs, composites posters, returns base64 PNGs.
// Photos are sent as base64 strings from the client (after local FileReader).
// No binary routing through multipart — photos are base64 encoded per request.

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { loadTemplateConfig, renderPoster, StudentForRender } from "@/lib/render";

export interface GenerateRequestBody {
  templateName: string;
  students: {
    RegNo: string;
    Name: string;
    Course: string;
    Branch: string;
    Company: string;
    OfferCategory: string;
    photoBase64: string; // data:image/...;base64,<data> or just base64 string
  }[];
}

export interface GenerateResponseBody {
  posters: string[]; // array of base64 PNG strings (one per page)
  posterCount: number;
  studentCount: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateRequestBody;
    const { templateName, students } = body;

    if (!templateName || !students || students.length === 0) {
      return NextResponse.json(
        { error: "Missing templateName or students" },
        { status: 400 }
      );
    }

    // Load template config
    const config = loadTemplateConfig(templateName);
    const templateImagePath = path.join(
      process.cwd(),
      "public",
      "templates",
      config.templateImage
    );

    const { slotsPerPoster } = config;

    // Decode photo buffers from base64
    const studentsWithBuffers: StudentForRender[] = students.map((s) => {
      // Strip data URI prefix if present
      const base64Data = s.photoBase64.replace(/^data:[^;]+;base64,/, "");
      const photoBuffer = Buffer.from(base64Data, "base64");
      return {
        RegNo: s.RegNo,
        Name: s.Name,
        Course: s.Course,
        Branch: s.Branch,
        Company: s.Company,
        OfferCategory: s.OfferCategory,
        photoBuffer,
      };
    });

    // Split into pages of slotsPerPoster
    const pages: StudentForRender[][] = [];
    for (let i = 0; i < studentsWithBuffers.length; i += slotsPerPoster) {
      pages.push(studentsWithBuffers.slice(i, i + slotsPerPoster));
    }

    // Render each page
    const posterBuffers = await Promise.all(
      pages.map((pageStudents) =>
        renderPoster(pageStudents, config, templateImagePath)
      )
    );

    const posters = posterBuffers.map((buf) => buf.toString("base64"));

    return NextResponse.json({
      posters,
      posterCount: posters.length,
      studentCount: students.length,
    } satisfies GenerateResponseBody);
  } catch (err) {
    console.error("[generate] error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
