const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const inputPath = 'C:/Users/luise/.gemini/antigravity-cli/brain/b56994d4-f49c-4ca4-97dd-de7bdd6cf38b/.user_uploaded/uploaded_media_1790736353350.png';
const outputDir = path.join(__dirname, '..', 'src', 'renderer', 'src', 'assets');
const outputPath = path.join(outputDir, 'chaos_icon.png');
const publicDir = path.join(__dirname, '..', 'src', 'renderer', 'public');

console.log('🖼️ Procesando icono centrado y recto...');

const fileData = fs.readFileSync(inputPath);
const png = PNG.sync.read(fileData);
const { width, height, data } = png;

// 1. Flood-fill para eliminar el fondo de cuadrícula
const visited = new Uint8Array(width * height);
const queue = [];

function isCheckerboard(idx) {
  const r = data[idx];
  const g = data[idx + 1];
  const b = data[idx + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  return (min > 185 && diff < 16);
}

for (let x = 0; x < width; x++) {
  queue.push(x, 0);
  queue.push(x, height - 1);
  visited[x] = 1;
  visited[(height - 1) * width + x] = 1;
}
for (let y = 0; y < height; y++) {
  queue.push(0, y);
  queue.push(width - 1, y);
  visited[y * width] = 1;
  visited[y * width + (width - 1)] = 1;
}

let head = 0;
while (head < queue.length) {
  const x = queue[head++];
  const y = queue[head++];
  const idx = (y * width + x) * 4;

  if (isCheckerboard(idx)) {
    data[idx + 3] = 0;

    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nPos = ny * width + nx;
        if (!visited[nPos]) {
          visited[nPos] = 1;
          queue.push(nx, ny);
        }
      }
    }
  }
}

// 2. Anti-aliasing defringe
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = (y * width + x) * 4;
    if (data[idx + 3] === 0) continue;

    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    if (min > 160 && diff < 35) {
      const alphaFactor = Math.max(0, (diff - 8) / 30);
      data[idx + 3] = Math.round(data[idx + 3] * alphaFactor);
      if (data[idx + 3] < 15) {
        data[idx + 3] = 0;
      }
    }
  }
}

// 3. Medición del cuerpo principal de la "C"
let minX = width, maxX = 0, minY = height, maxY = 0;
// Medimos también el fondo del cuerpo principal (ignorando el goteo fino)
let bodyBottomY = 0;

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const a = data[(y * width + x) * 4 + 3];
    if (a > 20) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

// Encontrar la base horizontal de la C (donde la base tiene al menos 100px de ancho)
for (let y = maxY; y >= minY; y--) {
  let count = 0;
  for (let x = minX; x <= maxX; x++) {
    if (data[(y * width + x) * 4 + 3] > 20) count++;
  }
  if (count > 100) {
    bodyBottomY = y;
    break;
  }
}

console.log(`Medidas: X=[${minX}..${maxX}], Y=[${minY}..${maxY}], Base=[${bodyBottomY}]`);

// Centro del cuerpo de la C (compensando el goteo para que quede ópticamente perfecto)
const bodyCenterX = (minX + maxX) / 2;
const bodyCenterY = (minY + bodyBottomY) / 2;

// Tamaño del lienzo cuadrado 1:1
const logoSpan = Math.max(maxX - minX, maxY - minY);
const squareSize = Math.round(logoSpan * 1.06); // 6% padding

const squarePng = new PNG({ width: squareSize, height: squareSize });
const targetCenterX = squareSize / 2;
const targetCenterY = squareSize / 2;

const shiftX = Math.round(targetCenterX - bodyCenterX);
const shiftY = Math.round(targetCenterY - bodyCenterY);

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const srcIdx = (y * width + x) * 4;
    const a = data[srcIdx + 3];
    if (a > 0) {
      const dstX = x + shiftX;
      const dstY = y + shiftY;
      if (dstX >= 0 && dstX < squareSize && dstY >= 0 && dstY < squareSize) {
        const dstIdx = (dstY * squareSize + dstX) * 4;
        squarePng.data[dstIdx] = data[srcIdx];
        squarePng.data[dstIdx + 1] = data[srcIdx + 1];
        squarePng.data[dstIdx + 2] = data[srcIdx + 2];
        squarePng.data[dstIdx + 3] = a;
      }
    }
  }
}

const outBuffer = PNG.sync.write(squarePng);
fs.writeFileSync(outputPath, outBuffer);
fs.writeFileSync(path.join(publicDir, 'icon.png'), outBuffer);
fs.writeFileSync(path.join(__dirname, '..', 'icon.png'), outBuffer);

console.log(`✅ Icono 1:1 perfectamente centrado guardado: ${squareSize}x${squareSize}`);
