const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIMIC_DIR = 'C:\\Users\\luise\\Documents\\Proyectos\\Mimic-server';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/LuisEnriqueGM03/mimic-server/main';

function getSha1(filePath) {
  const hash = crypto.createHash('sha1');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

function walkDir(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(walkDir(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function updateManifest(newVersion = '1.0.5', changelogNotes = ['Sincronización completa de todo el repositorio (configs, shaders, resourcepacks y mods)']) {
  const manifestPath = path.join(MIMIC_DIR, 'modpack.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('No se encontró modpack.json en', manifestPath);
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`Versión actual: ${manifest.version} -> Nueva versión: ${newVersion}`);
  manifest.version = newVersion;
  manifest.githubRepo = 'LuisEnriqueGM03/mimic-server';
  manifest.downloadUrl = `${GITHUB_RAW_BASE}/modpack.json`;

  const files = [];
  const processedChunks = new Set();

  // 1. Manejo especial de Chunks grandes en resourcepacks/chunks/
  const chunksDir = path.join(MIMIC_DIR, 'resourcepacks', 'chunks');
  if (fs.existsSync(chunksDir)) {
    const chunkFiles = fs.readdirSync(chunksDir);
    // Agrupar por nombre base: foo.zip.part1 -> foo.zip
    const chunkGroups = {};
    for (const cf of chunkFiles) {
      const match = cf.match(/^(.*)\.part(\d+)$/);
      if (match) {
        const baseName = match[1];
        if (!chunkGroups[baseName]) chunkGroups[baseName] = [];
        chunkGroups[baseName].push({
          file: cf,
          partNum: parseInt(match[2], 10),
          fullPath: path.join(chunksDir, cf),
          relPath: `resourcepacks/chunks/${cf}`.replace(/\\/g, '/')
        });
      }
    }

    for (const [baseName, parts] of Object.entries(chunkGroups)) {
      parts.sort((a, b) => a.partNum - b.partNum);
      const hash = crypto.createHash('sha1');
      let totalSize = 0;
      const partRels = [];
      for (const p of parts) {
        const buf = fs.readFileSync(p.fullPath);
        hash.update(buf);
        totalSize += buf.length;
        partRels.push(p.relPath);
        processedChunks.add(p.relPath);
      }
      const combinedSha1 = hash.digest('hex');
      files.push({
        path: `resourcepacks/${baseName}`,
        sha1: combinedSha1,
        size: totalSize,
        parts: partRels
      });
      console.log(`📦 Registrado resourcepack en chunks: resourcepacks/${baseName} (${parts.length} partes, ${(totalSize / 1024 / 1024).toFixed(1)} MB)`);
    }
  }

  // 2. Escanear carpetas principales del modpack
  const directoriesToScan = [
    'config',
    'defaultconfigs',
    'mods',
    'shaderpacks',
    'resourcepacks',
    'libraries',
    'versions'
  ];

  for (const dirName of directoriesToScan) {
    const targetDir = path.join(MIMIC_DIR, dirName);
    if (!fs.existsSync(targetDir)) continue;

    const allFiles = walkDir(targetDir);
    console.log(`📁 Escaneando "${dirName}": ${allFiles.length} archivos encontrados.`);

    for (const f of allFiles) {
      const rel = path.relative(MIMIC_DIR, f).replace(/\\/g, '/');
      if (processedChunks.has(rel)) continue; // Omitir partes ya manejadas en chunkGroups
      if (rel.endsWith('.disabled') || rel.endsWith('.tmp') || rel.includes('.git')) continue;

      const sha1 = getSha1(f);
      const size = fs.statSync(f).size;
      files.push({
        path: rel,
        sha1,
        size,
        downloadUrl: `${GITHUB_RAW_BASE}/${encodeURI(rel)}`
      });
    }
  }

  // 3. Archivos especiales en la raíz
  const rootFiles = ['EffekseerNativeForJava.dll', 'options.txt', 'servers.dat'];
  for (const rf of rootFiles) {
    const fullPath = path.join(MIMIC_DIR, rf);
    if (fs.existsSync(fullPath)) {
      const sha1 = getSha1(fullPath);
      const size = fs.statSync(fullPath).size;
      files.push({
        path: rf,
        sha1,
        size,
        downloadUrl: `${GITHUB_RAW_BASE}/${encodeURI(rf)}`
      });
      console.log(`📄 Registrado archivo raíz: ${rf}`);
    }
  }

  manifest.files = files;

  if (changelogNotes && changelogNotes.length > 0) {
    manifest.changelog = [
      ...changelogNotes,
      ...(manifest.changelog || [])
    ];
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n✅ modpack.json actualizado a v${newVersion} con ${manifest.files.length} archivos totales en todas las categorías.`);
}

module.exports = { updateManifest };

if (require.main === module) {
  updateManifest();
}
