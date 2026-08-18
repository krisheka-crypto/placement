const sharp = require('sharp');

async function findBoxes() {
  const img = sharp('public/templates/srm-ece-2027.png');
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  
  console.log(`Width: ${info.width}, Height: ${info.height}`);
  
  // We want to find rectangles of blue color.
  // We'll just scan the image and find rows and columns with blue pixels.
  // Blue color in template is around #003087 or similar.
  // Let's just find pixels where B > R + 50 and B > G + 50
  
  const width = info.width;
  const height = info.height;
  
  let bluePixels = [];
  
  for (let y = 0; y < height; y += 10) {
    for (let x = 0; x < width; x += 10) {
      const idx = (y * width + x) * info.channels;
      const r = data[idx];
      const g = data[idx+1];
      const b = data[idx+2];
      
      // The box lines are blue, background is white/light.
      // So r < 100, g < 100, b > 100 might work, or just find edges.
      if (b > 100 && r < 100 && g < 150 && b > r + 30 && b > g + 30) {
        bluePixels.push({x, y});
      }
    }
  }
  
  console.log(`Found ${bluePixels.length} blue-ish pixels sampled.`);
  
  // Cluster them by bounding boxes
  let boxes = [];
  for (const p of bluePixels) {
    let found = false;
    for (const b of boxes) {
      if (p.x >= b.minX - 50 && p.x <= b.maxX + 50 && p.y >= b.minY - 50 && p.y <= b.maxY + 50) {
        b.minX = Math.min(b.minX, p.x);
        b.maxX = Math.max(b.maxX, p.x);
        b.minY = Math.min(b.minY, p.y);
        b.maxY = Math.max(b.maxY, p.y);
        found = true;
        break;
      }
    }
    if (!found) {
      boxes.push({ minX: p.x, maxX: p.x, minY: p.y, maxY: p.y });
    }
  }
  
  // Filter for actual boxes
  boxes = boxes.filter(b => (b.maxX - b.minX) > 100 && (b.maxY - b.minY) > 100);
  
  console.log('Boxes:');
  boxes.forEach((b, i) => {
    console.log(`Box ${i}: x=${b.minX}, y=${b.minY}, w=${b.maxX - b.minX}, h=${b.maxY - b.minY}`);
  });
}

findBoxes().catch(console.error);
