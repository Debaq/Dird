#!/usr/bin/env node

/**
 * Script to verify API configuration
 * Usage: node scripts/check-config.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración de DIRD...\n');

// Check environment files
const envFiles = [
  '.env.development',
  '.env.production',
  '.env.example'
];

console.log('📁 Archivos de entorno:');
envFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const apiUrl = content.match(/VITE_API_BASE_URL=(.+)/);
    const useRelative = content.match(/VITE_API_USE_RELATIVE=(.+)/);

    if (useRelative) {
      console.log(`  ✅ ${file}: Ruta relativa (BASE/backend)`);
    } else if (apiUrl) {
      console.log(`  ✅ ${file}: ${apiUrl[1]}`);
    } else {
      console.log(`  ⚠️  ${file}: No VITE_API_BASE_URL o VITE_API_USE_RELATIVE`);
    }
  } else {
    console.log(`  ❌ ${file}: No existe`);
  }
});

console.log('\n📝 Archivo de configuración:');
const configPath = path.join(__dirname, '..', 'src', 'config', 'api.ts');
if (fs.existsSync(configPath)) {
  console.log('  ✅ src/config/api.ts existe');
} else {
  console.log('  ❌ src/config/api.ts no existe');
}

console.log('\n🎯 URLs configuradas:');
console.log('  Desarrollo (npm run dev):');
console.log('    → https://tmeduca.org/dird/backend (servidor remoto)');
console.log('  Producción (npm run build):');
console.log('    → BASE_URL/backend (relativa)');
console.log('    → Ejemplo: /dird/backend si BASE_URL=/dird/');

console.log('\n📋 Endpoints disponibles:');
const endpoints = [
  'get_tokens.php',
  'consume_token.php',
  'confirm_processing.php',
  'receive_contribution.php'
];

endpoints.forEach(endpoint => {
  console.log(`  - ${endpoint}`);
});

console.log('\n✅ Verificación completada');
console.log('\nPara cambiar la URL de producción, edita: .env.production');
console.log('Para cambiar la URL de desarrollo, edita: .env.development\n');
