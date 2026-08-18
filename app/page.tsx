"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Papa from "papaparse";
import JSZip from "jszip";
import { validateCSV, StudentRow, ValidationError } from "@/lib/validate";
import { matchPhotos, classifyMatches, MatchResult } from "@/lib/match";
import PhotoCropper from "@/app/components/PhotoCropper";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

// ─── Constants ────────────────────────────────────────────────────────────────
const TEMPLATE_NAME = "srm-ece-2027";
const CANVAS_WIDTH = 2480;
const CANVAS_HEIGHT = 3508;
// Slot aspect ratio: 380 wide × 450 tall
const SLOT_ASPECT = 380 / 450;

// ─── Step Indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: { num: Step; label: string }[] = [
    { num: 1, label: "Upload CSV" },
    { num: 2, label: "Upload Photos" },
    { num: 3, label: "Generate" },
  ];

  return (
    <div className="step-indicator">
      {steps.map((s, i) => {
        const status =
          current > s.num ? "completed" : current === s.num ? "active" : "";
        return (
          <React.Fragment key={s.num}>
            <div className={`step-item ${status}`}>
              <div className="step-circle">
                {current > s.num ? "✓" : s.num}
              </div>
              <span className="step-label">{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className="step-connector" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Step 1: Upload CSV ────────────────────────────────────────────────────────

interface Step1Props {
  onNext: (students: StudentRow[]) => void;
}

function StepUploadCSV({ onNext }: Step1Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    setErrors([]);
    setStudents([]);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const { valid, students: parsed, errors: validErrors } =
          validateCSV(result.data);
        setStudents(parsed);
        setErrors(validErrors);
      },
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const canProceed = students.length > 0 && errors.length === 0;

  return (
    <div className="card animate-in">
      <div className="card-header">
        <div className="card-icon">📋</div>
        <div>
          <div className="card-title">Upload Student CSV</div>
          <div className="card-desc">
            Required columns: RegNo, Name, Course, Branch, Company, OfferCategory, Photo
          </div>
        </div>
      </div>

      <div
        className={`drop-zone ${dragOver ? "drag-over" : ""} ${fileName ? "has-file" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          onClick={(e) => e.stopPropagation()}
        />
        <span className="drop-zone-icon">{fileName ? "✅" : "📁"}</span>
        <div className="drop-zone-title">
          {fileName ? fileName : "Drop your CSV here or click to browse"}
        </div>
        <div className="drop-zone-hint">
          {fileName ? "Click to replace" : "Supports .csv files"}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="error-panel animate-in mt-4">
          <div className="error-panel-title">
            ⚠️ {errors.length} validation error{errors.length !== 1 ? "s" : ""} — fix
            these before continuing
          </div>
          <ul className="error-list">
            {errors.map((err, i) => (
              <li key={i}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      {students.length > 0 && errors.length === 0 && (
        <div className="students-summary animate-in mt-4">
          <div className="students-summary-header">
            <span className="students-summary-title">Parsed Students</span>
            <span className="badge badge-gold">{students.length}</span>
          </div>
          <table className="student-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>RegNo</th>
                <th>Branch</th>
                <th>Company</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.RegNo}>
                  <td className="student-name-cell">{s.Name}</td>
                  <td className="text-muted text-xs">{s.RegNo}</td>
                  <td>{s.Branch}</td>
                  <td>{s.Company}</td>
                  <td>{s.OfferCategory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="action-bar">
        <span className="text-muted text-sm">
          {students.length > 0 && errors.length === 0
            ? `${students.length} student${students.length !== 1 ? "s" : ""} ready — ${Math.ceil(students.length / 6)} poster page${Math.ceil(students.length / 6) !== 1 ? "s" : ""}`
            : "Upload a CSV to continue"}
        </span>
        <button
          className="btn btn-primary"
          disabled={!canProceed}
          onClick={() => onNext(students)}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Upload Photos ─────────────────────────────────────────────────────

interface Step2Props {
  students: StudentRow[];
  onNext: (
    matchMap: Map<string, MatchResult>,
    files: File[],
    croppedMap: Map<string, string>
  ) => void;
  onBack: () => void;
}

function StepUploadPhotos({ students, onNext, onBack }: Step2Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [matchMap, setMatchMap] = useState<Map<string, MatchResult>>(new Map());
  const [dragOver, setDragOver] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // regNo → cropped data URL (set after user crops a photo)
  const [croppedMap, setCroppedMap] = useState<Map<string, string>>(new Map());
  // Which student's photo is currently open in the cropper modal
  const [cropperRegNo, setCropperRegNo] = useState<string | null>(null);

  const processFiles = useCallback(
    (newFiles: File[]) => {
      const validFiles = newFiles.filter((f) =>
        /\.(jpe?g|png|webp)$/i.test(f.name)
      );
      setFiles(validFiles);
      setCroppedMap(new Map()); // reset crops when new files are uploaded

      const map = matchPhotos(students, validFiles);
      setMatchMap(map);

      const prev: Record<string, string> = {};
      validFiles.forEach((f) => {
        prev[f.name] = URL.createObjectURL(f);
      });
      setPreviews(prev);
    },
    [students]
  );

  useEffect(() => {
    return () => {
      Object.values(previews).forEach(URL.revokeObjectURL);
    };
  }, [previews]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
  };

  // Save a cropped data URL for a student
  const handleCropSave = (regNo: string, dataUrl: string) => {
    setCroppedMap((prev) => new Map(prev).set(regNo, dataUrl));
    setCropperRegNo(null);
  };

  const { matched, unmatched } = classifyMatches(matchMap);
  const studentsWithoutPhoto = students.filter(
    (s) => !matchMap.has(s.RegNo) || !matchMap.get(s.RegNo)?.matchedFile
  );
  const canProceed = matched.length > 0;

  // Find which student a given file belongs to
  const fileToRegNo = (fileName: string): string | null => {
    for (const [regNo, res] of matchMap.entries()) {
      if (res.matchedFileName === fileName) return regNo;
    }
    return null;
  };

  const cropperStudent = cropperRegNo
    ? students.find((s) => s.RegNo === cropperRegNo)
    : null;
  const cropperImageSrc = cropperRegNo
    ? croppedMap.get(cropperRegNo) ||
      (matchMap.get(cropperRegNo)?.matchedFileName
        ? previews[matchMap.get(cropperRegNo)!.matchedFileName!]
        : null)
    : null;

  return (
    <>
      <div className="card animate-in">
        <div className="card-header">
          <div className="card-icon">🖼️</div>
          <div>
            <div className="card-title">Upload Student Photos</div>
            <div className="card-desc">
              Select all student photos at once. Matching is automatic — filenames
              may be RegNo-based (e.g. <code>RA2311004010497.jpeg</code>).
              Click ✂️ <strong>Crop</strong> on any thumbnail to adjust framing.
            </div>
          </div>
        </div>

        <div
          className={`drop-zone ${dragOver ? "drag-over" : ""} ${files.length > 0 ? "has-file" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            multiple
            onChange={handleFileChange}
            onClick={(e) => e.stopPropagation()}
          />
          <span className="drop-zone-icon">{files.length > 0 ? "🗂️" : "📷"}</span>
          <div className="drop-zone-title">
            {files.length > 0
              ? `${files.length} photo${files.length !== 1 ? "s" : ""} selected`
              : "Drop student photos here or click to browse"}
          </div>
          <div className="drop-zone-hint">
            {files.length > 0 ? "Click to replace all" : "JPEG / PNG accepted"}
          </div>
        </div>

        {files.length > 0 && (
          <>
            {/* Match summary */}
            <div className="flex items-center gap-3 mt-4">
              <span className="badge badge-green">✓ {matched.length} matched</span>
              {unmatched.length > 0 && (
                <span className="badge badge-red">✗ {unmatched.length} unmatched</span>
              )}
              {croppedMap.size > 0 && (
                <span className="badge badge-gold">✂️ {croppedMap.size} cropped</span>
              )}
              <span className="text-sm text-muted">
                ({files.length} photo{files.length !== 1 ? "s" : ""} uploaded)
              </span>
            </div>

            {studentsWithoutPhoto.length > 0 && (
              <div className="info-box warning mt-4">
                <span>⚠️</span>
                <div>
                  <strong>
                    {studentsWithoutPhoto.length} student
                    {studentsWithoutPhoto.length !== 1 ? "s" : ""} have no matched photo
                  </strong>{" "}
                  and will be excluded from generation:{" "}
                  {studentsWithoutPhoto.map((s) => s.Name).join(", ")}
                </div>
              </div>
            )}

            {/* Photo grid with Crop buttons */}
            <div className="photo-grid mt-4 animate-fade">
              {files.map((file) => {
                const regNo = fileToRegNo(file.name);
                const isMatched = !!regNo;
                const isCropped = regNo ? croppedMap.has(regNo) : false;
                const student = regNo
                  ? students.find((s) => s.RegNo === regNo)
                  : null;
                const displaySrc = regNo && croppedMap.get(regNo)
                  ? croppedMap.get(regNo)!
                  : previews[file.name];

                return (
                  <div
                    key={file.name}
                    className={`photo-thumb ${isMatched ? "matched" : "unmatched"}`}
                  >
                    {displaySrc && (
                      <img src={displaySrc} alt={file.name} />
                    )}

                    {/* Cropped badge */}
                    {isCropped && (
                      <div className="photo-thumb-cropped-badge">✂️ Cropped</div>
                    )}

                    <div className="photo-thumb-label">
                      {student?.Name || file.name}
                    </div>

                    {/* Status icon */}
                    <div
                      className={`photo-thumb-status ${isMatched ? "ok" : "err"}`}
                    >
                      {isMatched ? "✓" : "✗"}
                    </div>

                    {/* Crop button — only for matched photos */}
                    {isMatched && regNo && (
                      <button
                        className="photo-thumb-edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCropperRegNo(regNo);
                        }}
                      >
                        ✂️ Crop
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Per-student status table */}
            <div className="students-summary mt-6">
              <div className="students-summary-header">
                <span className="students-summary-title">Match Status per Student</span>
              </div>
              <table className="student-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>RegNo</th>
                    <th>Expected Photo</th>
                    <th>Status</th>
                    <th>Crop</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const res = matchMap.get(s.RegNo);
                    const isMatch = !!res?.matchedFile;
                    const isCropped = croppedMap.has(s.RegNo);
                    return (
                      <tr key={s.RegNo}>
                        <td className="student-name-cell">{s.Name}</td>
                        <td className="text-muted text-xs">{s.RegNo}</td>
                        <td className="text-muted text-xs">{s.Photo}</td>
                        <td>
                          <span
                            className={`photo-status ${isMatch ? "matched" : "unmatched"}`}
                          >
                            {isMatch ? "✓ " + res!.matchedFileName : "✗ No match"}
                          </span>
                        </td>
                        <td>
                          {isMatch && (
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => setCropperRegNo(s.RegNo)}
                            >
                              {isCropped ? "✂️ Re-crop" : "✂️ Crop"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="action-bar">
          <button className="btn btn-ghost" onClick={onBack}>
            ← Back
          </button>
          <button
            className="btn btn-primary"
            disabled={!canProceed}
            onClick={() => onNext(matchMap, files, croppedMap)}
          >
            Generate Posters →
          </button>
        </div>
      </div>

      {/* Cropper Modal */}
      {cropperRegNo && cropperStudent && cropperImageSrc && (
        <PhotoCropper
          imageSrc={cropperImageSrc}
          studentName={cropperStudent.Name}
          aspectRatio={SLOT_ASPECT}
          onSave={(dataUrl) => handleCropSave(cropperRegNo, dataUrl)}
          onCancel={() => setCropperRegNo(null)}
        />
      )}
    </>
  );
}

// ─── Step 3: Generate & Export ─────────────────────────────────────────────────

interface Step3Props {
  students: StudentRow[];
  matchMap: Map<string, MatchResult>;
  croppedMap: Map<string, string>;
  onBack: () => void;
}

function StepGenerate({ students, matchMap, croppedMap, onBack }: Step3Props) {
  const [posters, setPosters] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);

  const eligibleStudents = students.filter(
    (s) => matchMap.get(s.RegNo)?.matchedFile
  );
  const skippedStudents = students.filter(
    (s) => !matchMap.get(s.RegNo)?.matchedFile
  );

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setProgress(10);

    try {
      // For each eligible student: use cropped data URL if available,
      // otherwise read the original File as base64.
      const photoBase64s = await Promise.all(
        eligibleStudents.map(async (s) => {
          // User-cropped version takes priority
          if (croppedMap.has(s.RegNo)) {
            return croppedMap.get(s.RegNo)!;
          }
          // Fall back to original file
          const file = matchMap.get(s.RegNo)!.matchedFile!;
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );

      setProgress(40);

      const payload = {
        templateName: TEMPLATE_NAME,
        students: eligibleStudents.map((s, i) => ({
          ...s,
          photoBase64: photoBase64s[i],
        })),
      };

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setProgress(80);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Generation failed");
      }

      const data = await res.json();
      setPosters(data.posters);
      setProgress(100);
    } catch (err) {
      setError(String(err));
    } finally {
      setGenerating(false);
    }
  }, [eligibleStudents, matchMap, croppedMap]);

  const downloadPng = (base64: string, index: number) => {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${base64}`;
    link.download = `placement-poster-page-${index + 1}.png`;
    link.click();
  };

  const downloadAllZip = async () => {
    setExportingZip(true);
    try {
      const zip = new JSZip();
      posters.forEach((b64, i) => {
        zip.file(`placement-poster-page-${i + 1}.png`, b64, { base64: true });
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "placement-posters.zip";
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingZip(false);
    }
  };

  const downloadPdf = async () => {
    setExportingPdf(true);
    try {
      const res = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posters,
          canvasWidth: CANVAS_WIDTH,
          canvasHeight: CANVAS_HEIGHT,
          dpi: 300,
        }),
      });

      if (!res.ok) throw new Error("PDF export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "placement-posters.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(String(err));
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="card animate-in">
      <div className="card-header">
        <div className="card-icon">🎓</div>
        <div>
          <div className="card-title">Generate Placement Posters</div>
          <div className="card-desc">
            {eligibleStudents.length} student
            {eligibleStudents.length !== 1 ? "s" : ""} ready →{" "}
            {Math.ceil(eligibleStudents.length / 6)} poster page
            {Math.ceil(eligibleStudents.length / 6) !== 1 ? "s" : ""}
            {croppedMap.size > 0 && (
              <span className="text-accent"> · ✂️ {croppedMap.size} custom crop{croppedMap.size !== 1 ? "s" : ""} applied</span>
            )}
            {skippedStudents.length > 0 && (
              <span className="text-warning">
                {" "}· {skippedStudents.length} excluded (no photo)
              </span>
            )}
          </div>
        </div>
      </div>

      {skippedStudents.length > 0 && (
        <div className="info-box warning mt-4">
          <span>⚠️</span>
          <div>
            The following students are <strong>excluded</strong> because no
            matching photo was found:{" "}
            {skippedStudents.map((s) => s.Name).join(", ")}. Go back to upload
            their photos if needed.
          </div>
        </div>
      )}

      {posters.length === 0 && (
        <div className="flex items-center gap-4 mt-6">
          <button
            className="btn btn-primary btn-lg"
            disabled={generating || eligibleStudents.length === 0}
            onClick={generate}
          >
            {generating ? (
              <><span className="spinner" /> Generating…</>
            ) : (
              <>🚀 Generate Posters</>
            )}
          </button>
          {generating && (
            <span className="text-sm text-muted">
              Compositing images server-side…
            </span>
          )}
        </div>
      )}

      {generating && (
        <div className="progress-bar-wrap mt-3">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && (
        <div className="error-panel mt-4">
          <div className="error-panel-title">⚠️ Generation Error</div>
          <ul className="error-list">
            <li>{error}</li>
          </ul>
        </div>
      )}

      {posters.length > 0 && (
        <div className="preview-section animate-in">
          <div className="preview-section-title">
            🖼 {posters.length} Poster{posters.length !== 1 ? "s" : ""} Generated
          </div>

          <div className="poster-preview-grid">
            {posters.map((b64, i) => (
              <div key={i} className="poster-card">
                <img
                  className="poster-card-image"
                  src={`data:image/png;base64,${b64}`}
                  alt={`Poster page ${i + 1}`}
                />
                <div className="poster-card-footer">
                  <span className="poster-card-label">
                    Page {i + 1} of {posters.length}
                  </span>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => downloadPng(b64, i)}
                  >
                    ↓ PNG
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="export-row">
            <span className="export-row-label">Export all posters:</span>
            <button
              className="btn btn-secondary"
              onClick={downloadAllZip}
              disabled={exportingZip}
            >
              {exportingZip ? <><span className="spinner" /> Zipping…</> : "📦 Download ZIP (PNG)"}
            </button>
            <button
              className="btn btn-primary"
              onClick={downloadPdf}
              disabled={exportingPdf}
            >
              {exportingPdf ? <><span className="spinner" /> Building PDF…</> : "📄 Download PDF"}
            </button>
          </div>

          <button
            className="btn btn-ghost btn-sm mt-4"
            onClick={() => { setPosters([]); setProgress(0); }}
          >
            ↺ Regenerate
          </button>
        </div>
      )}

      <div className="action-bar">
        <button className="btn btn-ghost" onClick={onBack} disabled={generating}>
          ← Back
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [step, setStep] = useState<Step>(1);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [matchMap, setMatchMap] = useState<Map<string, MatchResult>>(new Map());
  const [croppedMap, setCroppedMap] = useState<Map<string, string>>(new Map());

  const handleCSVDone = (parsedStudents: StudentRow[]) => {
    setStudents(parsedStudents);
    setStep(2);
  };

  const handlePhotosDone = (
    map: Map<string, MatchResult>,
    _files: File[],
    crops: Map<string, string>
  ) => {
    setMatchMap(map);
    setCroppedMap(crops);
    setStep(3);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-logo">
          <div className="header-logo-badge">🎓</div>
          <div>
            <div className="header-title">SRM ECE · Placement Poster Generator</div>
            <div className="header-subtitle">Campus to Career 2027</div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="page-hero">
          <h1>Generate Placement Posters</h1>
          <p>
            Upload your CSV and student photos to create print-ready placement
            posters in seconds — no design work required.
          </p>
        </div>

        <StepIndicator current={step} />

        {step === 1 && <StepUploadCSV onNext={handleCSVDone} />}
        {step === 2 && (
          <StepUploadPhotos
            students={students}
            onNext={handlePhotosDone}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <StepGenerate
            students={students}
            matchMap={matchMap}
            croppedMap={croppedMap}
            onBack={() => setStep(2)}
          />
        )}
      </main>
    </div>
  );
}
