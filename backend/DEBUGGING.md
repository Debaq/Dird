# Guía de Depuración - Sistema de IA con Groq

## 🔍 Si el Test de IA no funciona

Cuando subes los archivos a tu servidor y el test de IA devuelve un error JSON, sigue estos pasos:

### Paso 1: Verificar Diagnóstico del Servidor

Abre en tu navegador:
```
https://tu-dominio.com/backend/admin/diagnose.php
```

Esto te mostrará:
- ✅ Versión de PHP
- ✅ Archivos y directorios necesarios
- ✅ Funciones PHP disponibles
- ✅ Configuración de logger
- ✅ Estado de API Key

**Busca estos valores:**
- `includes_exists`: debe ser `true`
- `logs_dir_writable`: debe ser `true`
- `curl_available`: debe ser `true`
- `logger_test`: debe ser `success_with_file`
- `groq_api_key`: debe decir `configured (length: 56)`

### Paso 2: Verificar Permisos en el Servidor

Conecta via SSH o FTP y ejecuta:

```bash
# Asegúrate de que estos directorios tengan los permisos correctos
chmod 755 backend/includes
chmod 644 backend/includes/logger.php
chmod 777 backend/logs
chmod 644 backend/data/ai_config.json
chmod 644 backend/data/api_keys.json
```

### Paso 3: Ver los Logs

#### Opción A: Desde el Panel de Admin
1. Ve a **Panel de Administración**
2. Click en tab **"Logs"**
3. Verás todos los eventos en tiempo real

#### Opción B: Via SSH/Terminal
```bash
# Ver últimas 50 líneas del log de debug
tail -50 backend/logs/api_debug.log

# Ver errores
tail -50 backend/logs/api_errors.log

# Seguir en tiempo real
tail -f backend/logs/api_debug.log
```

#### Opción C: Via FTP/cPanel
1. Navega a `backend/logs/`
2. Descarga `api_debug.log` o `api_errors.log`
3. Ábrelos con un editor de texto

### Paso 4: Probar el Endpoint Manualmente

Via cURL (SSH):
```bash
cd backend

# Crear payload de prueba
cat > test_payload.json << 'EOF'
{
  "model": "llama-3.3-70b-versatile",
  "system_prompt": "Test",
  "test_data": {"test": "data"}
}
EOF

# Hacer petición
curl -X POST https://tu-dominio.com/backend/admin/test_ai_config.php \
  -H "Content-Type: application/json" \
  -d @test_payload.json

# Debe devolver JSON válido con "success": true
```

### Paso 5: Errores Comunes

#### Error: "Unexpected token '<'"
**Causa:** PHP está devolviendo HTML (un error) en lugar de JSON

**Solución:**
1. Ve a `backend/logs/api_errors.log`
2. Busca el error específico
3. Verifica que `display_errors` esté en `0` en `test_ai_config.php`

#### Error: "No se crean logs"
**Causa:** El directorio `logs/` no es escribible

**Solución:**
```bash
chmod 777 backend/logs
chown www-data:www-data backend/logs  # En Ubuntu/Debian
chown apache:apache backend/logs       # En CentOS/RHEL
```

#### Error: "API Key not configured"
**Causa:** El archivo `api_keys.json` no existe o está vacío

**Solución:**
1. Ve al panel de admin → IA / Groq
2. Ingresa tu API Key de Groq
3. Click en "Actualizar"
4. Verifica que `backend/data/api_keys.json` se creó

#### Error: "cURL not available"
**Causa:** PHP no tiene la extensión cURL instalada

**Solución:**
```bash
# Ubuntu/Debian
sudo apt-get install php-curl
sudo service apache2 restart

# CentOS/RHEL
sudo yum install php-curl
sudo service httpd restart
```

### Paso 6: Habilitar Logging Temporal

Si aún no funciona, edita `backend/admin/test_ai_config.php` temporalmente:

Cambia la línea 3 de:
```php
error_reporting(E_ERROR | E_PARSE);
```

A:
```php
error_reporting(E_ALL);
```

Y la línea 4 de:
```php
ini_set('display_errors', '0');
```

A:
```php
ini_set('display_errors', '1');
```

Luego ejecuta el test y verás TODOS los errores PHP directamente. **Recuerda revertir estos cambios después de depurar.**

## 📧 Soporte

Si después de seguir todos estos pasos aún tienes problemas:

1. Copia el output de `diagnose.php`
2. Copia las últimas 100 líneas de `api_debug.log`
3. Copia el mensaje de error exacto que recibes
4. Envía esta información para análisis

## ✅ Verificación Final

Todo funciona correctamente cuando:
- ✅ `diagnose.php` muestra todos los checks en verde
- ✅ Los logs se crean en `backend/logs/`
- ✅ El test devuelve JSON con `"success": true`
- ✅ El visor de logs en el admin muestra actividad
