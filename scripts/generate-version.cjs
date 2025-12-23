// scripts/generate-version.cjs
const fs = require('fs');
const path = require('path');

// Generar información de versión basada en timestamp
const timestamp = Date.now();
const version = `build-${timestamp}`;

const versionInfo = {
  version: version,
  timestamp: timestamp,
  buildNumber: timestamp
};

// Asegurar que la carpeta public existe
const publicDir = path.join(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Escribir el archivo de versión
const versionFilePath = path.join(publicDir, 'version.json');
fs.writeFileSync(versionFilePath, JSON.stringify(versionInfo, null, 2));

console.log(`Archivo de versión generado: ${versionInfo.version}`);