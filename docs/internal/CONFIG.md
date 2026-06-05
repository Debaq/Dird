# Configuración de DIRD

## Variables de Entorno

DIRD utiliza variables de entorno para configurar las URLs de la API según el entorno (desarrollo o producción).

### Archivos de Configuración

#### `.env.development` (Desarrollo local)
```bash
# Apunta al servidor remoto para desarrollo/testing
VITE_API_BASE_URL=https://tmeduca.org/dird/backend
```

**Uso:** Durante el desarrollo local (`npm run dev`), el frontend se conecta al backend remoto en `tmeduca.org` para probar contra datos reales.

#### `.env.production` (Build/Producción)
```bash
# Usa ruta relativa porque el build ya estará en el servidor
VITE_API_USE_RELATIVE=true
```

**Uso:** El build final usa ruta relativa `BASE/backend` donde BASE es el `BASE_URL` de `vite.config.ts` (actualmente `/dird/`). Esto significa que el backend estará en `/dird/backend` junto con los archivos del frontend.

### Cómo Cambiar la URL de la API

#### Opción 1: Producción con Ruta Relativa (Recomendado)

En `.env.production`, usa:
```bash
VITE_API_USE_RELATIVE=true
```

Esto hará que el backend esté en `BASE_URL/backend`. Por ejemplo:
- Si `BASE_URL=/dird/` → backend estará en `/dird/backend`
- Si `BASE_URL=/` → backend estará en `/backend`

El `BASE_URL` se configura en `vite.config.ts`:
```typescript
export default defineConfig({
  base: '/dird/' // <-- Cambiar aquí si es necesario
})
```

#### Opción 2: URL Absoluta (Alternativa)

Si necesitas apuntar a otro servidor, edita `.env.production`:
```bash
VITE_API_BASE_URL=https://tu-dominio.com/backend
```

#### Opción 3: Desarrollo

Para desarrollo, edita `.env.development`:
```bash
VITE_API_BASE_URL=http://localhost:puerto/backend
```

#### Opción 2: Editar configuración TypeScript

Si prefieres valores por defecto diferentes, edita `src/config/api.ts`:

```typescript
export const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;

  if (envUrl) {
    return envUrl;
  }

  // Cambia estos valores por defecto
  if (import.meta.env.PROD) {
    return 'https://tu-dominio.com/backend'; // Producción
  }

  return 'http://localhost:8000/backend'; // Desarrollo
};
```

### Endpoints Disponibles

La configuración define los siguientes endpoints:

- `GET_TOKENS`: Obtener/registrar tokens de instalación
- `PROCESS_CONCLUSION`: Procesar datos de conclusión
- `CONFIRM_PROCESSING`: Confirmar procesamiento y consumir token
- `CONTRIBUTE`: Enviar contribuciones de imágenes

Todos se construyen automáticamente a partir de `VITE_API_BASE_URL`.

### Verificar Configuración

Ejecuta el script de verificación:
```bash
npm run check-config
```

En modo desarrollo, la configuración se muestra en la consola del navegador:
```
🔧 API Configuration:
  Base URL: https://tmeduca.org/dird/backend
  Environment: development
```

En producción (después de build), la URL será relativa:
```
🔧 API Configuration:
  Base URL: /dird/backend
  Environment: production
```

### Builds

- **Desarrollo**: `npm run dev` usa `.env.development` → `https://tmeduca.org/dird/backend` (servidor remoto)
- **Producción**: `npm run build` usa `.env.production` → `BASE_URL/backend` (ej: `/dird/backend`) (ruta relativa)

### Notas Importantes

1. Las variables deben empezar con `VITE_` para ser accesibles en el código
2. Los archivos `.env.development` y `.env.production` NO se suben a Git
3. El archivo `.env.example` documenta las variables disponibles
4. Después de cambiar variables de entorno, reinicia el servidor de desarrollo

## Estructura de Backend

El backend debe estar disponible en `/dird/backend/` (relativo al sitio web) con la siguiente estructura:

```
/dird/backend/
├── get_tokens.php           # Gestión de tokens
├── consume_token.php        # Procesamiento de conclusiones
├── confirm_processing.php   # Confirmación y consumo de token
├── receive_contribution.php # Recepción de contribuciones
└── tokens.json             # Base de datos de tokens (generado automáticamente)
```

**Ejemplo de estructura completa del servidor:**
```
/var/www/html/
├── dird/                    # Frontend (archivos del build)
│   ├── index.html
│   ├── assets/
│   └── backend/            # ← Backend PHP aquí
│       ├── get_tokens.php
│       ├── consume_token.php
│       ├── confirm_processing.php
│       ├── receive_contribution.php
│       └── tokens.json
```

## Ejemplo de Despliegue

### Servidor Producción

```bash
# 1. Clonar repositorio
git clone https://github.com/tu-repo/dird.git
cd dird

# 2. Configurar para usar ruta relativa (ya está por defecto en .env.production)
cat .env.production
# Debería mostrar: VITE_API_USE_RELATIVE=true

# 3. Instalar dependencias
npm install

# 4. Construir (asume BASE_URL=/dird/ en vite.config.ts)
npm run build

# 5. Subir archivos al servidor
# Los archivos de dist/ van a /var/www/html/dird/
# Los archivos de backend/ van a /var/www/html/dird/backend/

# 6. Estructura final en el servidor:
# /var/www/html/dird/
# ├── index.html           (del build)
# ├── assets/              (del build)
# └── backend/             (archivos PHP)
#     ├── get_tokens.php
#     ├── consume_token.php
#     ├── confirm_processing.php
#     └── receive_contribution.php

# 7. Dar permisos de escritura a tokens.json
chmod 666 /var/www/html/dird/backend/tokens.json
```

### Servidor Local (Testing)

```bash
# 1. Configurar URL local
echo "VITE_API_BASE_URL=http://localhost:8000/backend" > .env.development

# 2. Iniciar servidor PHP (en carpeta del proyecto)
php -S localhost:8000

# 3. Iniciar desarrollo de frontend
npm run dev
```
