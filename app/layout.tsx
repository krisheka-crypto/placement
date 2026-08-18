// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SRM ECE Placement Poster Generator",
  description:
    "Generate print-ready placement posters for SRM ECE department. Upload a CSV and student photos to create professional Campus to Career posters instantly.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
