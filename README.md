# DIRD+ — Plataforma de Detección de Retinopatía Diabética

<p align="center">
  <img src="public/logo.svg" alt="DIRD+ Logo" width="120" />
</p>

<p align="center">
  Plataforma web <em>privacy-first</em> de análisis oftalmológico con inteligencia artificial ejecutada completamente en el navegador.
</p>

---

## Tabla de Contenidos

- [Visión General](#visión-general)
- [Propuesta de Valor](#propuesta-de-valor)
- [Stack Tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Funcionalidades](#funcionalidades)
  - [Gestión de Pacientes y Sesiones](#gestión-de-pacientes-y-sesiones)
  - [Análisis con IA en el Navegador](#análisis-con-ia-en-el-navegador)
  - [Canvas Interactivo de Anotación](#canvas-interactivo-de-anotación)
  - [Clasificación Clínica Multi-Guía](#clasificación-clínica-multi-guía)
  - [Generación de Informes PDF](#generación-de-informes-pdf)
  - [Comparación de Sesiones](#comparación-de-sesiones)
  - [Exportación e Importación](#exportación-e-importación)
  - [Sistema de Contribución](#sistema-de-contribución)
  - [Academia](#academia)
  - [Panel de Administración](#panel-de-administración)
- [Instalación](#instalación)
  - [Desarrollo Local](#desarrollo-local)
  - [Build de Producción](#build-de-producción)
- [Configuración](#configuración)
- [Despliegue](#despliegue)
- [Guías Clínicas Soportadas](#guías-clínicas-soportadas)
- [Licencia](#licencia)

---

## Visión General

DIRD+ es una aplicación web diseñada para el análisis de imágenes de fondo de ojo (fundoscopía) utilizando modelos de visión artificial ejecutados **íntegramente en el navegador** mediante ONNX Runtime Web (WebAssembly). No requiere servidor para el procesamiento de imágenes — los datos del paciente nunca abandonan el dispositivo.

La plataforma permite a oftalmólogos, tecnólogos médicos e investigadores:

1. Gestionar pacientes y sesiones clínicas
2. Subir imágenes de fondo de ojo y procesarlas con IA (detección + segmentación)
3. Revisar y corregir hallazgos en un canvas interactivo multicapa
4. Clasificar severidad de retinopatía diabética según guías clínicas oficiales
5. Generar informes PDF configurables con conclusiones clínicas
6. Exportar/importar datos completos en formato `.dird`

---

## Propuesta de Valor

| Aspecto | Detalle |
|---------|---------|
| **Privacidad total** | Inferencia IA en el navegador. Cero transmisión de imágenes a servidores externos |
| **Persistencia local** | IndexedDB para almacenamiento completo de datos en el dispositivo |
| **Sin dependencias de infraestructura** | No requiere GPU en servidor, ni API de IA externa para el análisis |
| **Guías clínicas extensibles** | Sistema pluggable de guías (ICDR 2024, MINSAL Chile 2017). Agregar nuevas guías sin modificar código |
| **Portabilidad** | Formato `.dird` (ZIP) permite mover pacientes completos entre instalaciones |
| **Multilenguaje** | Español (base) e Inglés. Arquitectura i18n extensible |

---

## Stack Tecnológico

### Frontend
| Tecnología | Versión | Rol |
|-----------|---------|-----|
| React | 18.3 | Framework UI |
| TypeScript | 5.7 | Tipado estático (strict mode) |
| Vite | 6.0 | Build tool + dev server |
| Tailwind CSS | 3.4 | Estilos utilitarios |
| Radix UI | — | Componentes accesibles (Dialog, Tabs, Select, Switch, Slider) |
| React Router | 6 | Navegación SPA |
| Zustand | 5.0 | Estado global (config, canvas, tokens, pacientes) |
| Framer Motion | 11 | Animaciones |

### IA e Inferencia
| Tecnología | Versión | Rol |
|-----------|---------|-----|
| ONNX Runtime Web | 1.23 | Inferencia WebAssembly en navegador |
| Modelos ONNX | — | Detección (bounding boxes) + Segmentación (máscaras) |
| OpenCV.js | — | Refinamiento del disco óptico (CDN) |

### Canvas y Visualización
| Tecnología | Versión | Rol |
|-----------|---------|-----|
| Konva | 10 | Motor canvas 2D |
| React-Konva | 18.2 | Bindings React para Konva |

### Almacenamiento
| Tecnología | Versión | Rol |
|-----------|---------|-----|
| Dexie | 4.0 | Wrapper IndexedDB (16 migraciones versionadas) |
| JSZip | 3.10 | Formato `.dird` (ZIP con datos de paciente) |

### Informes
| Tecnología | Versión | Rol |
|-----------|---------|-----|
| jsPDF | 2.5 | Generación PDF en cliente |
| jspdf-autotable | 3.8 | Tablas en PDF |

### Backend (opcional)
| Tecnología | Rol |
|-----------|-----|
| PHP | API de tokens, contribuciones y administración |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                   NAVEGADOR                         │
│                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  React   │  │ ONNX Runtime │  │  IndexedDB   │  │
│  │  UI/SPA  │  │  (WASM)      │  │  (Dexie)     │  │
│  │          │◄─┤  Modelos VA  │  │  Pacientes   │  │
│  │  Canvas  │  │  Detección   │  │  Sesiones    │  │
│  │  Konva   │  │  Segmentac.  │  │  Imágenes    │  │
│  │          │  │              │  │  Detecciones  │  │
│  │  PDF     │  │  OpenCV.js   │  │  Informes    │  │
│  │  jsPDF   │  │  (CDN)       │  │              │  │
│  └──────────┘  └──────────────┘  └──────────────┘  │
│         │                                           │
└─────────┼───────────────────────────────────────────┘
          │ (opcional)
          ▼
┌─────────────────────┐
│  Backend PHP        │
│  - Tokens           │
│  - Contribuciones   │
│  - Administración   │
└─────────────────────┘
```

### Estructura del proyecto

```
src/
├── components/           # Componentes React
│   ├── canvas/          # Canvas de anotación multicapa
│   ├── patients/        # Gestión de pacientes
│   ├── upload/          # Carga de imágenes
│   ├── reports/         # Generación de informes
│   ├── settings/        # Configuración
│   ├── admin/           # Panel de administración
│   ├── contribution/    # Contribución de datos
│   ├── academy/         # Contenido educativo
│   └── ui/              # Primitivas UI reutilizables
├── lib/
│   ├── ai/              # Servicio de inferencia ONNX, descarga de modelos
│   ├── analysis/        # Clasificadores DR, análisis por cuadrante, edema
│   ├── clinical-guidelines/  # Motor de guías clínicas pluggable
│   ├── db/              # Esquema Dexie (IndexedDB)
│   ├── export/          # Import/export formato .dird
│   ├── pdf/             # Renderizado de informes PDF
│   └── classes/         # Gestor de clases de detección
├── stores/              # Estado global (Zustand)
├── i18n/                # Internacionalización (es/en)
├── types/               # Interfaces TypeScript
└── App.tsx              # Router principal
```

---

## Funcionalidades

### Gestión de Pacientes y Sesiones

- **Pacientes**: Crear, editar, archivar y buscar por nombre o ID
- **Datos clínicos**: Diabetes (tipo, duración), HTA, dislipidemia, medicamentos
- **Sesiones**: Representan una visita clínica. Se pueden duplicar, editar y cerrar
- **Cierre de sesión**: Un informe finalizado cierra la sesión, impidiendo modificaciones posteriores

### Análisis con IA en el Navegador

- **Modelos duales**: Detección (bounding boxes) + Segmentación (máscaras de píxeles)
- **Ejecución local**: ONNX Runtime Web con optimización SIMD y multi-thread
- **Descarga progresiva**: Modelos descargados desde GitHub Releases, cacheados en el navegador
- **Configuración de sensibilidad**: Umbral de confianza ajustable por modelo
- **Optimización por CPU**: Perfiles para Intel, AMD y ARM
- **Procesamiento batch**: Procesar todas las imágenes de una sesión de una vez

### Canvas Interactivo de Anotación

Sistema multicapa para revisión y corrección de hallazgos IA:

- **Capas**: Imagen original, detecciones IA, segmentaciones IA, anotaciones manuales, mediciones
- **Herramientas**: Selección, dibujo libre, polígono, medición (distancia/área), zoom, pan
- **Controles por capa**: Visibilidad, opacidad, bloqueo
- **Overlays clínicos**: Cuadrantes retinales, zona macular, área del disco óptico
- **Edición**: Modificar, ocultar o agregar detecciones manualmente

### Clasificación Clínica Multi-Guía

Motor de clasificación de severidad de retinopatía diabética:

- **Análisis por cuadrante**: Distribución de lesiones en 4 zonas + centro
- **Detectores especializados**:
  - Hemorragias (dot/blot)
  - Microaneurismas
  - Edema macular
  - Relación copa/disco óptico
- **Resultado**: Severidad, tratamientos recomendados, plazo de seguimiento, nivel de urgencia
- **Modificación manual**: El clínico puede ajustar la clasificación generada

### Generación de Informes PDF

- **Modo Preview**: Generar borrador sin consumir token
- **Modo Final**: Informe definitivo (consume 1 token por informe)
- **Secciones configurables**: Información del paciente, galería de imágenes, estadísticas, conclusión
- **Galería personalizable**: Imágenes originales/anotadas, con/sin cuadrantes y mediciones
- **Notas del evaluador**: Campo libre para observaciones clínicas
- **Firma**: Soporte para firma del profesional
- **Edición de conclusión**: Modificar la conclusión generada antes de finalizar

### Comparación de Sesiones

- Comparar estadísticas entre 2 o más sesiones del mismo paciente
- Conteo de detecciones, severidad promedio, análisis de tendencia
- Galerías de imágenes lado a lado

### Exportación e Importación

- **Formato `.dird`**: Archivo ZIP con toda la información del paciente o sesión
- **Exportar paciente**: Incluye todas las sesiones, imágenes, detecciones e informes
- **Exportar sesión**: Datos específicos de una sesión individual
- **Importar**: Restaurar pacientes o sesiones en otra instalación

### Sistema de Contribución

- Subir imágenes al dataset compartido para mejorar modelos
- Enviar clasificaciones de retinopatía diabética
- Seguimiento de contribuciones pendientes

### Academia

- Visor de contenido educativo sobre clasificación de retinopatía diabética
- Guías de referencia clínica y ejemplos

### Panel de Administración

- Autenticación por contraseña
- Gestión de tokens por instalación
- Visualización de contribuciones recibidas
- Sistema de mensajería a instalaciones
- Monitoreo de beacons (instalaciones activas)

---

## Instalación

### Desarrollo Local

```bash
# Clonar repositorio
git clone https://github.com/Debaq/Dird.git
cd Dird

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El servidor de desarrollo usa `.env.development` y apunta al backend remoto de `tmeduca.org` por defecto.

### Build de Producción

```bash
# Build completo (type-check + vite build + version.json + .htaccess)
npm run build

# Preview del build
npm run preview

# Verificar configuración
npm run check-config
```

---

## Configuración

La configuración se divide en dos niveles:

### Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| `VITE_API_BASE_URL` | URL absoluta del backend PHP |
| `VITE_API_USE_RELATIVE` | `true` para usar ruta relativa al `BASE_URL` |

Ver [CONFIG.md](CONFIG.md) para detalles completos de configuración y despliegue.

### Configuración en la Aplicación

Accesible desde el menú **Configuración**:

- **Modelos IA**: Rutas de modelos, sensibilidad de detección/segmentación
- **Procesamiento**: Tamaño máximo de imagen, calidad de compresión, vendor de CPU, refinamiento de disco óptico
- **Informes**: Secciones visibles, campos del paciente, configuración de galería, firma
- **Apariencia**: Tema, idioma, color primario
- **Guías Clínicas**: Selección de guía activa para clasificación

---

## Despliegue

### Estructura en servidor

```
/var/www/html/dird/
├── index.html              # Frontend (build)
├── assets/                 # JS/CSS hasheados
├── clinical-guidelines/    # JSONs de guías clínicas
├── docs/                   # Documentación clínica
└── backend/                # API PHP
    ├── get_tokens.php
    ├── consume_token.php
    ├── confirm_processing.php
    ├── receive_contribution.php
    └── admin/
```

---

## Guías Clínicas Soportadas

| Guía | País | Descripción |
|------|------|-------------|
| **ICDR 2024** | Internacional | International Clinical Diabetic Retinopathy Disease Severity Scale |
| **MINSAL Chile 2017** | Chile | Guía Clínica de Retinopatía Diabética del Ministerio de Salud |

Las guías son archivos JSON en `public/clinical-guidelines/`. Para agregar una nueva guía:

1. Crear archivo JSON siguiendo el esquema existente
2. Registrarla en `public/clinical-guidelines/index.json`
3. La aplicación la detectará automáticamente

---

## Licencia

Proyecto desarrollado por el equipo de TMeduca / Universidad de Chile.
