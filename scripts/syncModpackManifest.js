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

function updateManifest(newVersion = '1.0.2', changelogNotes = ['Añadidos mods: Chunk Tree Fix, Macaws Doors, Macaws Trapdoors, Toms Simple Storage']) {
  const manifestPath = path.join(MIMIC_DIR, 'modpack.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('No se encontró modpack.json en', manifestPath);
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`Versión actual: ${manifest.version} -> Nueva versión: ${newVersion}`);
  manifest.version = newVersion;

  // Filtrar archivos de mods existentes y sincronizar con los mods reales en el directorio
  const modsDir = path.join(MIMIC_DIR, 'mods');
  const currentJars = fs.readdirSync(modsDir).filter(f => f.endsWith('.jar'));
  console.log(`Total mods en disco: ${currentJars.length}`);

  // Mapa de archivos no-mods existentes
  const nonModFiles = manifest.files.filter(f => !f.path.startsWith('mods/'));

  // Re-indexar mods
  const modFiles = [];
  for (const jar of currentJars) {
    const fullPath = path.join(modsDir, jar);
    const rel = `mods/${jar}`;
    const sha1 = getSha1(fullPath);
    const size = fs.statSync(fullPath).size;

    modFiles.push({
      path: rel,
      sha1,
      size,
      downloadUrl: `${GITHUB_RAW_BASE}/${encodeURI(rel)}`
    });
  }

  manifest.files = [...modFiles, ...nonModFiles];

  // Actualizar changelog si se especificó
  if (changelogNotes && changelogNotes.length > 0) {
    manifest.changelog = [
      ...changelogNotes,
      ...(manifest.changelog || [])
    ];
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`✅ modpack.json actualizado a v${newVersion} con ${manifest.files.length} archivos (${modFiles.length} mods).`);
}

module.exports = { updateManifest };

if (require.main === module) {
  updateManifest();
}
