/**
 * Generate .htaccess file for deployment
 * Reads DEPLOY_BASE_URL from vite.config.ts and generates appropriate .htaccess
 */

const fs = require('fs');
const path = require('path');

// Read vite.config.ts to extract DEPLOY_BASE_URL
const viteConfigPath = path.join(__dirname, '..', 'vite.config.ts');
const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');

// Extract DEPLOY_BASE_URL value
const match = viteConfig.match(/const DEPLOY_BASE_URL = ['"](.+?)['"]/);
const baseUrl = match ? match[1] : '/';

// Remove trailing slash for RewriteBase
const rewriteBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
const rewriteTarget = baseUrl;

console.log(`Generating .htaccess for: ${baseUrl}`);

const htaccessContent = `# .htaccess para Dird
# Generado automáticamente para: ${baseUrl}
# NO EDITAR - Se regenera en cada build

<IfModule mod_rewrite.c>
  RewriteEngine On

  # Base para reescritura
  RewriteBase ${rewriteBase}/

  # Si es un archivo o directorio existente, servirlo directamente
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d

  # Redirigir todas las rutas a index.html (para React Router)
  RewriteRule . ${rewriteTarget}index.html [L]
</IfModule>

# Headers para CORS (necesarios para WASM y ONNX)
<IfModule mod_headers.c>
  <FilesMatch "\\.(wasm|onnx)$">
    Header set Cross-Origin-Embedder-Policy "credentialless"
    Header set Cross-Origin-Opener-Policy "same-origin"
  </FilesMatch>
</IfModule>

# Comprimir archivos estáticos
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
  AddOutputFilterByType DEFLATE application/wasm
</IfModule>

# Cache control
<IfModule mod_expires.c>
  ExpiresActive On

  # Assets con hash - cache largo (1 año)
  <FilesMatch "\\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|wasm|onnx)$">
    ExpiresDefault "access plus 1 year"
  </FilesMatch>

  # HTML - sin cache (siempre fresco)
  <FilesMatch "\\.(html)$">
    ExpiresDefault "access plus 0 seconds"
    Header set Cache-Control "no-cache, no-store, must-revalidate"
    Header set Pragma "no-cache"
    Header set Expires 0
  </FilesMatch>

  # Manifest y SW - cache corto
  <FilesMatch "\\.(webmanifest|json)$">
    ExpiresDefault "access plus 1 hour"
  </FilesMatch>
</IfModule>

# Seguridad básica
<IfModule mod_headers.c>
  # Prevenir clickjacking
  Header always set X-Frame-Options "SAMEORIGIN"

  # Prevenir MIME sniffing
  Header always set X-Content-Type-Options "nosniff"

  # XSS Protection
  Header always set X-XSS-Protection "1; mode=block"
</IfModule>
`;

// Write to dist/.htaccess
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const htaccessPath = path.join(distDir, '.htaccess');
fs.writeFileSync(htaccessPath, htaccessContent);

console.log(`.htaccess generado en: ${htaccessPath}`);
console.log(`RewriteBase: ${rewriteBase}/`);
