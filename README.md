# Placement Poster Generator

A Next.js web application designed for the SRM ECE department to automatically generate print-ready placement posters from a CSV of student data and a batch of student photos. This tool eliminates manual graphic design work by compositing the data and photos onto a predefined template using a server-side rendering engine.

## Features

- **Automated Poster Generation**: Turns a CSV of placed students and a folder of student photos into print-ready A4 placement posters.
- **Client-Side CSV Validation**: Parses and validates the CSV (using PapaParse) in the browser, ensuring all required columns and data are present before generation.
- **Smart Photo Matching**: Automatically matches uploaded photos to students using RegNo or Name stems (case-insensitive and extension-flexible).
- **Interactive Photo Cropping**: Built-in image cropper (`react-easy-crop`) allows you to perfectly frame student faces before generating the poster.
- **Server-Side Compositing**: Uses `sharp` in a Next.js API route to dynamically draw student photos and auto-shrinking SVG text onto a high-resolution template.
- **Bulk Export**: Download the generated posters as a ZIP of high-res PNGs or as a single multi-page PDF (using `pdf-lib`).
- **Template Configuration**: Coordinates and typography settings are decoupled from the code and live in a JSON config file, allowing for easy calibration or the addition of new templates.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, TypeScript)
- **Styling**: Vanilla CSS with a custom design system
- **Image Processing**: [sharp](https://sharp.pixelplumbing.com/) (Server-side)
- **Data Parsing**: [PapaParse](https://www.papaparse.com/) (Client-side)
- **Image Cropping**: [react-easy-crop](https://github.com/ricardo-ch/react-easy-crop)
- **PDF Generation**: [pdf-lib](https://pdf-lib.js.org/)

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/krisheka-crypto/placement.git
   cd placement
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev -- --webpack
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Usage Workflow

The application operates as a simple 3-step wizard:

1. **Upload CSV**: Drag and drop your `Students.csv` file. The app will validate the required columns (`RegNo`, `Name`, `Course`, `Branch`, `Company`, `OfferCategory`, `Photo`).
2. **Upload Photos**: Select the batch of student photos. The app will automatically match them to the students in the CSV. You can click on any matched photo to manually crop and frame it.
3. **Generate & Export**: Click generate to build the posters. You can preview the generated pages and download them as a ZIP archive or a PDF document.

## Configuration

The placement of the photos and text is controlled by a template configuration file located at `config/templates/srm-ece-2027.json`. This file defines the canvas dimensions, font sizes, colors, and exact `x`/`y` coordinates for each of the slots on the poster.

## License

This project is licensed under the MIT License.
