const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SOURCE_DIR = 'C:\\Users\\luise\\curseforge\\minecraft\\Instances\\Mimic MC';
const TARGET_DIR = 'C:\\Users\\luise\\Documents\\Proyectos\\Mimic-server';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/LuisEnriqueGM03/mimic-server/main';

function getSha1(filePath) {
  const hash = crypto.createHash('sha1');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

function copyRecursive(src, dest, filterFn) {
  if (!fs.existsSync(src)) return [];
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const items = fs.readdirSync(src);
    const copied = [];
    for (const item of items) {
      copied.push(...copyRecursive(path.join(src, item), path.join(dest, item), filterFn));
    }
    return copied;
  } else {
    if (filterFn && !filterFn(src)) return [];
    const parent = path.dirname(dest);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    fs.copyFileSync(src, dest);
    return [dest];
  }
}

function splitFileIntoParts(filePath, outputDir, maxPartBytes = 70 * 1024 * 1024) {
  const stat = fs.statSync(filePath);
  const totalSize = stat.size;
  const fileName = path.basename(filePath);
  const partCount = Math.ceil(totalSize / maxPartBytes);
  
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(maxPartBytes);
  const partPaths = [];
  
  let offset = 0;
  for (let i = 1; i <= partCount; i++) {
    const bytesToRead = Math.min(maxPartBytes, totalSize - offset);
    fs.readSync(fd, buffer, 0, bytesToRead, offset);
    
    const partName = `${fileName}.part${i}`;
    const partPath = path.join(outputDir, partName);
    fs.writeFileSync(partPath, buffer.subarray(0, bytesToRead));
    
    partPaths.push(partPath);
    offset += bytesToRead;
  }
  fs.closeSync(fd);
  return partPaths;
}

async function prepare() {
  console.log(`🚀 Iniciando preparación del modpack Mimic MC...`);
  console.log(`📁 Origen: ${SOURCE_DIR}`);
  console.log(`📁 Destino: ${TARGET_DIR}`);

  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  const manifestFiles = [];

  // 1. Copiar mods (.jar)
  console.log(`\n📦 Copiando mods...`);
  const srcMods = path.join(SOURCE_DIR, 'mods');
  const destMods = path.join(TARGET_DIR, 'mods');
  const copiedMods = copyRecursive(srcMods, destMods, (f) => f.endsWith('.jar'));
  console.log(`✅ ${copiedMods.length} mods copiados.`);

  for (const modFile of copiedMods) {
    const rel = path.relative(TARGET_DIR, modFile).replace(/\\/g, '/');
    const sha1 = getSha1(modFile);
    const size = fs.statSync(modFile).size;
    manifestFiles.push({
      path: rel,
      sha1,
      size,
      downloadUrl: `${GITHUB_RAW_BASE}/${rel}`
    });
  }

  // 2. Copiar config y defaultconfigs
  console.log(`\n⚙️ Copiando configs y defaultconfigs...`);
  const srcConfig = path.join(SOURCE_DIR, 'config');
  const destConfig = path.join(TARGET_DIR, 'config');
  const copiedConfig = copyRecursive(srcConfig, destConfig);
  console.log(`✅ ${copiedConfig.length} archivos de config copiados.`);

  const srcDefConfigs = path.join(SOURCE_DIR, 'defaultconfigs');
  const destDefConfigs = path.join(TARGET_DIR, 'defaultconfigs');
  const copiedDefConfigs = copyRecursive(srcDefConfigs, destDefConfigs);
  console.log(`✅ ${copiedDefConfigs.length} defaultconfigs copiados.`);

  for (const cfgFile of [...copiedConfig, ...copiedDefConfigs]) {
    const rel = path.relative(TARGET_DIR, cfgFile).replace(/\\/g, '/');
    manifestFiles.push({
      path: rel,
      sha1: getSha1(cfgFile),
      size: fs.statSync(cfgFile).size,
      downloadUrl: `${GITHUB_RAW_BASE}/${rel}`
    });
  }

  // 3. Copiar options.txt y servers.dat
  console.log(`\n🎮 Copiando options.txt y servers.dat...`);
  for (const specialFile of ['options.txt', 'servers.dat', 'EffekseerNativeForJava.dll']) {
    const s = path.join(SOURCE_DIR, specialFile);
    const d = path.join(TARGET_DIR, specialFile);
    if (fs.existsSync(s)) {
      fs.copyFileSync(s, d);
      const rel = specialFile;
      manifestFiles.push({
        path: rel,
        sha1: getSha1(d),
        size: fs.statSync(d).size,
        downloadUrl: `${GITHUB_RAW_BASE}/${rel}`
      });
      console.log(`✅ ${specialFile} copiado.`);
    }
  }

  // 4. Copiar shaderpacks
  console.log(`\n🌅 Copiando shaderpacks...`);
  const srcShaders = path.join(SOURCE_DIR, 'shaderpacks');
  const destShaders = path.join(TARGET_DIR, 'shaderpacks');
  const copiedShaders = copyRecursive(srcShaders, destShaders);
  console.log(`✅ ${copiedShaders.length} shaderpacks copiados.`);

  for (const shFile of copiedShaders) {
    const rel = path.relative(TARGET_DIR, shFile).replace(/\\/g, '/');
    manifestFiles.push({
      path: rel,
      sha1: getSha1(shFile),
      size: fs.statSync(shFile).size,
      downloadUrl: `${GITHUB_RAW_BASE}/${rel}`
    });
  }

  // 5. Copiar resourcepacks y procesar archivos > 95 MB en chunks
  console.log(`\n🎵 Procesando resourcepacks...`);
  const srcRP = path.join(SOURCE_DIR, 'resourcepacks');
  const destRP = path.join(TARGET_DIR, 'resourcepacks');
  const chunksDir = path.join(destRP, 'chunks');

  if (fs.existsSync(srcRP)) {
    const rpItems = fs.readdirSync(srcRP);
    for (const item of rpItems) {
      const fullSrc = path.join(srcRP, item);
      const stat = fs.statSync(fullSrc);

      if (stat.isFile() && stat.size > 95 * 1024 * 1024) {
        // Archivo grande > 95 MB -> DIVIDIR EN CHUNKS
        console.log(`✂️ Dividiendo archivo grande (>95MB): ${item} (${Math.round(stat.size / 1024 / 1024)} MB)`);
        const originalSha1 = getSha1(fullSrc);
        const originalSize = stat.size;

        const parts = splitFileIntoParts(fullSrc, chunksDir, 68 * 1024 * 1024);
        const partRels = parts.map(p => path.relative(TARGET_DIR, p).replace(/\\/g, '/'));

        console.log(`  -> Creadas ${parts.length} partes: ${partRels.join(', ')}`);

        // Registrar en el manifiesto con sus partes
        const relDest = `resourcepacks/${item}`;
        manifestFiles.push({
          path: relDest,
          sha1: originalSha1,
          size: originalSize,
          parts: partRels
        });
      } else {
        // Archivo o carpeta normal
        const fullDest = path.join(destRP, item);
        const copied = copyRecursive(fullSrc, fullDest);
        for (const f of copied) {
          const rel = path.relative(TARGET_DIR, f).replace(/\\/g, '/');
          manifestFiles.push({
            path: rel,
            sha1: getSha1(f),
            size: fs.statSync(f).size,
            downloadUrl: `${GITHUB_RAW_BASE}/${rel}`
          });
        }
      }
    }
  }

  // 6. Generar .gitignore
  const gitignoreContent = `# Archivos temporales de Minecraft
logs/
crash-reports/
saves/
usercache.json
.mixin.out/
.boss_checklist_data/
*.disabled

# Excluir archivos gigantes en crudo si se copiaran por error
resourcepacks/Medieval_Background_Music-1.19.3-2.0.zip
resourcepacks/Refreshing Soundtracks!.zip
`;
  fs.writeFileSync(path.join(TARGET_DIR, '.gitignore'), gitignoreContent, 'utf8');

  // 7. Generar modpack.json v1.0.1
  const modpackManifest = {
    name: "Mimic MC",
    version: "1.0.1",
    minecraftVersion: "1.21.1",
    loader: {
      type: "neoforge",
      version: "21.1.248"
    },
    server: {
      ip: "mimicsv.glemtrod.com",
      port: 25565
    },
    recommendedRam: 6144,
    optionalMods: [
      {
        id: "distant_horizons",
        name: "Distant Horizons",
        file: "DistantHorizons-3.3.3-1.21.1-fabric-neoforge.jar",
        description: "Renderizado de mundos a larguísima distancia (LOD). Desactivado por defecto para maximizar FPS. Actívalo si tu PC lo soporta.",
        defaultEnabled: false
      },
      {
        id: "iris_shaders",
        name: "Iris Shaders",
        file: "iris-neoforge-1.8.14-beta.1+mc1.21.1.jar",
        description: "Soporte para Shaders de alto rendimiento gráfico. Desactívalo si experimentas tirones o bajadas de FPS.",
        defaultEnabled: true
      },
      {
        id: "lamb_dynamic_lights",
        name: "LambDynamicLights",
        file: "lambdynamiclights-4.8.11+1.21.1.jar",
        description: "Iluminación dinámica en tiempo real al sostener antorchas u objetos luminosos.",
        defaultEnabled: true
      }
    ],
    changelog: [
      "🔭 Añadido mod Distant Horizons (renderizado de mundos a larga distancia)",
      "⚔️ Versión oficial 1.0.1 de Mimic MC Server",
      "⚡ NeoForge 21.1.248 optimizado con más de 280 mods RPG y exploración",
      "✨ Soporte integrado para shaders Iris y luces dinámicas",
      "🛡️ Servidor oficial integrado: mimicsv.glemtrod.com"
    ],
    files: manifestFiles
  };

  const manifestPath = path.join(TARGET_DIR, 'modpack.json');
  fs.writeFileSync(manifestPath, JSON.stringify(modpackManifest, null, 2), 'utf8');
  console.log(`\n📄 modpack.json generado exitosamente con ${manifestFiles.length} archivos indexados.`);
  console.log(`🎉 ¡Preparación completada! Listo para commit y push a Git.`);
}

prepare().catch(err => {
  console.error("❌ Error durante la preparación:", err);
  process.exit(1);
});
