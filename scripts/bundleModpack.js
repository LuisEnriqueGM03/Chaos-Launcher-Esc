const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const contentDir = path.join(__dirname, '..', 'modpack-content');
const outputZip = path.join(__dirname, '..', 'modpack-server-example', 'pack-example.zip');
const manifestPath = path.join(__dirname, '..', 'modpack-server-example', 'modpack.json');

console.log('📦 Empaquetando modpack...');

// Si no existe modpack-content, crear estructura de ejemplo
if (!fs.existsSync(contentDir)) {
  fs.mkdirSync(path.join(contentDir, 'mods'), { recursive: true });
  fs.mkdirSync(path.join(contentDir, 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(contentDir, 'mods', 'ejemplo-mod.txt'),
    'Coloca aqui tus archivos .jar de mods para empaquetar\n'
  );
  fs.writeFileSync(
    path.join(contentDir, 'config', 'server-config.txt'),
    'Configuraciones predeterminadas para los jugadores\n'
  );
}

const zip = new AdmZip();
zip.addLocalFolder(contentDir);
zip.writeZip(outputZip);

console.log(`✅ Modpack comprimido exitosamente en: ${outputZip}`);

// Actualizar tamaño en el manifiesto
if (fs.existsSync(manifestPath)) {
  const stat = fs.statSync(outputZip);
  const sizeMb = Math.round(stat.size / (1024 * 1024)) || 1;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.fileSizeMb = sizeMb;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`📄 Manifiesto actualizado con peso: ${sizeMb} MB`);
}
