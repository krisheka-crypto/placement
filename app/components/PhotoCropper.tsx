"use client";

import React, { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PhotoCropperProps {
  imageSrc: string;        // object URL or data URL of the original photo
  studentName: string;
  aspectRatio: number;     // width / height — comes from template slot config
  onSave: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

// ─── Helper — crop the image on a canvas and return a data URL ─────────────
async function getCroppedImage(
  imageSrc: string,
  pixelCrop: Area,
  outputWidth: number,
  outputHeight: number
): Promise<string> {
  const image = await createImageBitmap(await fetch(imageSrc).then((r) => r.blob()));

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return canvas.toDataURL("image/jpeg", 0.92);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PhotoCropper({
  imageSrc,
  studentName,
  aspectRatio,
  onSave,
  onCancel,
}: PhotoCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      // Output at the template slot resolution (380 × 450 scaled up 2× for sharpness)
      const outputW = Math.round(380 * 2);
      const outputH = Math.round(450 * 2);
      const dataUrl = await getCroppedImage(imageSrc, croppedAreaPixels, outputW, outputH);
      onSave(dataUrl);
    } finally {
      setSaving(false);
    }
  };

  return (
    /* Backdrop */
    <div className="cropper-backdrop" onClick={onCancel}>
      {/* Modal — stop propagation so clicking inside doesn't close */}
      <div className="cropper-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cropper-header">
          <div>
            <div className="cropper-title">Crop Photo</div>
            <div className="cropper-subtitle">{studentName}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>
            ✕
          </button>
        </div>

        {/* Crop area */}
        <div className="cropper-stage">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            cropShape="rect"
            showGrid
            style={{
              containerStyle: { borderRadius: "8px", overflow: "hidden" },
            }}
          />
        </div>

        {/* Zoom slider */}
        <div className="cropper-controls">
          <span className="text-xs text-muted">🔍 Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="zoom-slider"
          />
          <span className="text-xs text-muted">{zoom.toFixed(2)}×</span>
        </div>

        {/* Actions */}
        <div className="cropper-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <><span className="spinner" /> Saving…</>
            ) : (
              "✓ Use this crop"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
