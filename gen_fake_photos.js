const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const photos = [
  'RA2311004010497.jpeg',
  'RA2311043010009.jpeg',
  'RA2311004010597.jpeg',
  'RA2311053010028.jpeg',
  'RA2311043010073.jpeg',
  'RA2311043010054.jpeg'
];

const outDir = path.join(__dirname, 'fake_photos');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

async function generate() {
  for (const photo of photos) {
    await sharp({
      create: {
        width: 400,
        height: 500,
        channels: 3,
        background: { r: 200, g: 200, b: 200 }
      }
    })
    .jpeg()
    .toFile(path.join(outDir, photo));
    console.log(`Generated ${photo}`);
  }
}

generate().catch(console.error);
