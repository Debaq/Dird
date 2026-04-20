#!/usr/bin/env bash
#
# dird.sh - Script de gestion para DIRD+
# Uso: ./dird.sh [comando]
# Sin argumentos: abre menu interactivo
#

set -uo pipefail

# ── Colores ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── Variables ────────────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
TAURI_DIR="$PROJECT_DIR/src-tauri"
DIST_DIR="$PROJECT_DIR/dist"
BINARY_NAME="app"
APP_IDENTIFIER="org.tmeduca.dird"
VERSION=$(grep '"version"' "$PROJECT_DIR/package.json" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')

_detect_cargo_target() {
    if [[ -n "${CARGO_TARGET_DIR:-}" ]]; then
        echo "$CARGO_TARGET_DIR"
    elif grep -q 'target-dir' ~/.cargo/config.toml 2>/dev/null; then
        grep 'target-dir' ~/.cargo/config.toml | head -1 | sed 's/.*= *"\(.*\)".*/\1/' | sed "s|~|$HOME|"
    else
        echo "$TAURI_DIR/target"
    fi
}
CARGO_TARGET="$(_detect_cargo_target)"
BUNDLE_DIR="$CARGO_TARGET/release/bundle"

find_binary() {
    local name="${1:-$BINARY_NAME}"
    for dir in "$CARGO_TARGET/release" "$TAURI_DIR/target/release"; do
        if [[ -f "$dir/$name" ]]; then
            echo "$dir/$name"
            return 0
        fi
    done
    return 1
}

# ── Funciones auxiliares ─────────────────────────────────────────────────────
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}=== $* ===${NC}\n"; }

elapsed() {
    local start=$1
    local end=$(date +%s)
    local diff=$((end - start))
    echo "$((diff / 60))m $((diff % 60))s"
}

pause_after() {
    echo ""
    echo -e "${DIM}Presiona ENTER para volver al menu...${NC}"
    read -r
}

# ── Verificacion de dependencias ─────────────────────────────────────────────
check_deps() {
    header "Verificando dependencias"
    local missing=0

    for cmd in node pnpm cargo rustc; do
        if command -v "$cmd" &>/dev/null; then
            success "$cmd -> $(command $cmd --version 2>/dev/null | head -1)"
        else
            error "$cmd no encontrado"
            missing=1
        fi
    done

    if pnpm tauri --version &>/dev/null; then
        success "tauri-cli -> $(pnpm tauri --version 2>/dev/null | tail -1)"
    else
        error "tauri-cli no encontrado (pnpm add -D @tauri-apps/cli)"
        missing=1
    fi

    if [[ $missing -eq 1 ]]; then
        error "Faltan dependencias obligatorias"
        return 1
    fi
    success "Todas las dependencias disponibles"
}

# ── Instalar dependencias ────────────────────────────────────────────────────
cmd_install() {
    header "Instalando dependencias"
    cd "$PROJECT_DIR"
    pnpm install
    success "Dependencias pnpm instaladas"
}

# ── Desarrollo ───────────────────────────────────────────────────────────────
cmd_dev() {
    header "Modo desarrollo (Tauri)"
    check_deps || return
    cd "$PROJECT_DIR"
    info "Iniciando Tauri + Vite hot reload..."
    pnpm tauri dev || true
}

cmd_dev_web() {
    header "Frontend dev (solo navegador)"
    cd "$PROJECT_DIR"
    info "Iniciando Vite dev server... (Ctrl+C para detener)"
    pnpm dev || true
}

# ── Check ────────────────────────────────────────────────────────────────────
cmd_check() {
    header "Verificacion rapida"
    local start=$(date +%s)
    local errors=0

    info "TypeScript check..."
    cd "$PROJECT_DIR"
    if pnpm type-check; then
        success "TypeScript OK"
    else
        error "TypeScript tiene errores"
        errors=1
    fi

    info "Cargo check..."
    cd "$TAURI_DIR"
    if cargo check; then
        success "Rust OK"
    else
        error "Rust tiene errores"
        errors=1
    fi

    if [[ $errors -eq 0 ]]; then
        success "Todo OK en $(elapsed $start)"
    else
        error "Hay errores ($(elapsed $start))"
    fi
}

# ── Tests ────────────────────────────────────────────────────────────────────
cmd_test() {
    header "Tests (Vitest)"
    cd "$PROJECT_DIR"
    local start=$(date +%s)
    if pnpm test; then
        success "Tests OK en $(elapsed $start)"
    else
        error "Tests fallaron ($(elapsed $start))"
        return 1
    fi
}

# ── Build ────────────────────────────────────────────────────────────────────
cmd_build() {
    header "Build DIRD+ v$VERSION"
    check_deps || return
    local start=$(date +%s)
    cd "$PROJECT_DIR"

    info "Compilando release (NO_STRIP=true para Arch moderno)..."
    NO_STRIP=true pnpm tauri build

    success "Build completo en $(elapsed $start)"
    collect_artifacts
}

cmd_build_debug() {
    header "Build debug"
    cd "$PROJECT_DIR"
    local start=$(date +%s)

    info "Compilando en modo debug..."
    pnpm tauri build --debug

    success "Build debug en $(elapsed $start)"
}

cmd_build_frontend() {
    header "Build frontend"
    local start=$(date +%s)
    cd "$PROJECT_DIR"

    info "TypeScript + Vite build..."
    pnpm build

    success "Frontend compilado en $(elapsed $start)"
}

# ── Ejecutar binario ─────────────────────────────────────────────────────────
cmd_run() {
    local bin="$(find_binary || echo '')"
    if [[ ! -f "$bin" ]]; then
        error "Binario no encontrado. Ejecuta 'build' primero."
        return 1
    fi
    header "Ejecutando DIRD+ v$VERSION"
    "$bin" "$@" || true
}

# ── Recopilar artefactos ─────────────────────────────────────────────────────
collect_artifacts() {
    local out="$PROJECT_DIR/out/$(date '+%Y-%m-%d_%H-%M')"
    mkdir -p "$out"

    local bin="$(find_binary || echo '')"
    if [[ -f "$bin" ]]; then
        cp "$bin" "$out/dird"
        success "Binario en: $out/dird"
    fi

    if [[ -d "$BUNDLE_DIR" ]]; then
        local patterns=("DIRD*" "dird*")
        for type in deb rpm appimage msi nsis dmg; do
            [[ -d "$BUNDLE_DIR/$type" ]] || continue
            for pat in "${patterns[@]}"; do
                for item in "$BUNDLE_DIR/$type"/$pat; do
                    [[ -e "$item" ]] && cp -r "$item" "$out/" 2>/dev/null || true
                done
            done
        done
    fi

    if [[ -n "$(ls -A "$out" 2>/dev/null)" ]]; then
        ls -lh "$out" | tail -n +2
    else
        rmdir "$out" 2>/dev/null
        warn "No se encontraron artefactos"
    fi
}

# ── Storage local (IndexedDB + WebKit) ───────────────────────────────────────
cmd_storage_path() {
    header "Ubicacion del storage local"
    echo -e "${BOLD}Linux:${NC}   ~/.local/share/$APP_IDENTIFIER/ (WebKit local storage + IndexedDB)"
    echo -e "${BOLD}Windows:${NC} %APPDATA%\\$APP_IDENTIFIER\\"
    echo -e "${BOLD}macOS:${NC}   ~/Library/Application Support/$APP_IDENTIFIER/"
    echo ""
    local paths=(
        "$HOME/.local/share/$APP_IDENTIFIER"
        "$HOME/.config/$APP_IDENTIFIER"
        "$HOME/.cache/$APP_IDENTIFIER"
    )
    for p in "${paths[@]}"; do
        if [[ -d "$p" ]]; then
            success "Existe: $p ($(du -sh "$p" 2>/dev/null | cut -f1))"
        fi
    done
}

cmd_storage_reset() {
    header "Reset storage local"
    warn "Esto borra IndexedDB (pacientes, sesiones, imagenes) y config guardada"
    local paths=(
        "$HOME/.local/share/$APP_IDENTIFIER"
        "$HOME/.config/$APP_IDENTIFIER"
        "$HOME/.cache/$APP_IDENTIFIER"
    )
    local found=0
    for p in "${paths[@]}"; do
        if [[ -d "$p" ]]; then
            warn "Encontrado: $p ($(du -sh "$p" 2>/dev/null | cut -f1))"
            read -rp "¿Eliminar $p? (s/N) " ans
            if [[ "$ans" =~ ^[sS]$ ]]; then
                rm -rf "$p"
                success "Eliminado: $p"
                found=1
            fi
        fi
    done
    [[ $found -eq 0 ]] && info "No se encontro storage existente"
}

# ── Limpiar ──────────────────────────────────────────────────────────────────
cmd_clean() {
    header "Limpieza"
    info "Limpiando dist/ + cargo clean..."
    rm -rf "$DIST_DIR"
    cd "$TAURI_DIR" && cargo clean
    success "Limpio"
}

# ── Info ─────────────────────────────────────────────────────────────────────
cmd_info() {
    header "DIRD+ v$VERSION"
    echo -e "${BOLD}Directorio:${NC} $PROJECT_DIR"
    echo -e "${BOLD}Identifier:${NC} $APP_IDENTIFIER"
    echo -e "${BOLD}Node:${NC}       $(node --version 2>/dev/null || echo 'N/A')"
    echo -e "${BOLD}pnpm:${NC}       $(pnpm --version 2>/dev/null || echo 'N/A')"
    echo -e "${BOLD}Rust:${NC}       $(rustc --version 2>/dev/null || echo 'N/A')"
    echo -e "${BOLD}Tauri:${NC}      $(pnpm tauri --version 2>/dev/null | tail -1 || echo 'N/A')"
    echo -e "${BOLD}Branch:${NC}     $(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo 'N/A')"
    echo -e "${BOLD}Commit:${NC}     $(git -C "$PROJECT_DIR" log --oneline -1 2>/dev/null || echo 'N/A')"
    local bin="$(find_binary || echo '')"
    if [[ -f "$bin" ]]; then
        echo -e "${BOLD}Binario:${NC}    $bin ($(du -h "$bin" | cut -f1))"
    fi
}

# ── Release ──────────────────────────────────────────────────────────────────
cmd_release() {
    header "Nuevo release"
    cd "$PROJECT_DIR"

    if ! command -v gh &>/dev/null; then
        error "gh (GitHub CLI) no instalado"
        return 1
    fi

    if [[ -n "$(git status --porcelain)" ]]; then
        error "Hay cambios sin commitear. Commitea o stashea antes."
        git status --short
        return 1
    fi

    local branch=$(git branch --show-current)
    if [[ "$branch" != "main" && "$branch" != "v2.2025" ]]; then
        warn "No estas en main/v2.2025 (actual: $branch)"
        read -rp "¿Continuar de todas formas? (s/N) " ans
        [[ "$ans" =~ ^[sS]$ ]] || return 1
    fi

    local current="$VERSION"
    local IFS='.'
    read -r major minor patch <<< "$current"
    unset IFS

    if [[ -z "$major" || -z "$minor" || -z "$patch" ]]; then
        error "Version actual invalida: $current"
        return 1
    fi

    local next_major="$((major + 1)).0.0"
    local next_minor="$major.$((minor + 1)).0"
    local next_patch="$major.$minor.$((patch + 1))"

    echo -e "${BOLD}Version actual:${NC} ${CYAN}v$current${NC}"
    echo ""
    echo -e "  ${GREEN}1${NC}) patch  -> v${next_patch}  ${DIM}(fixes, cambios menores)${NC}"
    echo -e "  ${YELLOW}2${NC}) minor  -> v${next_minor}  ${DIM}(features nuevas compatibles)${NC}"
    echo -e "  ${RED}3${NC}) major  -> v${next_major}  ${DIM}(cambios breaking)${NC}"
    echo -e "  ${BLUE}4${NC}) custom ${DIM}(escribir version manual)${NC}"
    echo -e "  ${DIM}0) cancelar${NC}"
    echo ""
    read -rp "Opcion: " opt

    local new_version=""
    case "$opt" in
        1) new_version="$next_patch" ;;
        2) new_version="$next_minor" ;;
        3) new_version="$next_major" ;;
        4)
            read -rp "Nueva version (X.Y.Z): " new_version
            if [[ ! "$new_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                error "Formato invalido. Debe ser X.Y.Z"
                return 1
            fi
            ;;
        0|"") info "Cancelado"; return 0 ;;
        *) error "Opcion no valida"; return 1 ;;
    esac

    if git rev-parse "v$new_version" &>/dev/null; then
        error "Tag v$new_version ya existe"
        return 1
    fi

    local last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    echo ""
    echo -e "${BOLD}Commits desde ${last_tag:-inicio}:${NC}"
    if [[ -n "$last_tag" ]]; then
        git log "${last_tag}..HEAD" --oneline | head -30
    else
        git log --oneline | head -30
    fi
    echo ""

    echo -e "${BOLD}Resumen:${NC}"
    echo -e "  v${CYAN}$current${NC} -> v${GREEN}$new_version${NC}"
    echo -e "  - Actualiza package.json, tauri.conf.json, Cargo.toml, Cargo.lock"
    echo -e "  - Crea commit chore(release): v$new_version"
    echo -e "  - Crea tag v$new_version"
    echo -e "  - Push a origin/$branch + tag"
    echo ""
    read -rp "¿Confirmar? (s/N) " confirm
    [[ "$confirm" =~ ^[sS]$ ]] || { info "Cancelado"; return 0; }

    info "Actualizando archivos de version..."
    sed -i "s/\"version\": \"$current\"/\"version\": \"$new_version\"/" "$PROJECT_DIR/package.json"
    sed -i "s/\"version\": \"$current\"/\"version\": \"$new_version\"/" "$TAURI_DIR/tauri.conf.json"
    sed -i "s/^version = \"$current\"/version = \"$new_version\"/" "$TAURI_DIR/Cargo.toml"
    python3 -c "
import re, sys
p = '$TAURI_DIR/Cargo.lock'
with open(p) as f: s = f.read()
s = re.sub(r'(name = \"$BINARY_NAME\"\nversion = \")$current(\")', r'\g<1>$new_version\g<2>', s)
with open(p, 'w') as f: f.write(s)
" 2>/dev/null || {
        warn "python3 no disponible, usando sed para Cargo.lock (menos seguro)"
        sed -i "/^name = \"$BINARY_NAME\"$/,/^version = / s/^version = \"$current\"/version = \"$new_version\"/" "$TAURI_DIR/Cargo.lock"
    }

    success "Versiones actualizadas a $new_version"

    info "Creando commit..."
    git add package.json "$TAURI_DIR/tauri.conf.json" "$TAURI_DIR/Cargo.toml" "$TAURI_DIR/Cargo.lock"
    git commit -m "chore(release): v$new_version"

    info "Creando tag v$new_version..."
    git tag -a "v$new_version" -m "DIRD+ v$new_version"

    info "Push a origin..."
    git push origin "$branch"
    git push origin "v$new_version"

    success "Release v$new_version publicado"
}

# ══════════════════════════════════════════════════════════════════════════════
# ── MENU INTERACTIVO ─────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

show_banner() {
    clear
    echo -e "${BOLD}${MAGENTA}"
    echo "  ____ ___ ____  ____  _   "
    echo " |  _ \\_ _|  _ \\|  _ \\| |_ "
    echo " | | | | || |_) | | | |  _|"
    echo " | |_| | ||  _ <| |_| | |_ "
    echo " |____/___|_| \\_\\____/ \\__|"
    echo -e "${NC}"
    echo -e "${DIM}  Deteccion de Retinopatia Diabetica con IA Edge-Computing · v$VERSION"
    echo -e "  $(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo '-') · $(git -C "$PROJECT_DIR" log --oneline -1 2>/dev/null | cut -c1-50 || echo '-')${NC}"
    echo ""
}

show_menu() {
    echo -e "${BOLD} DESARROLLO${NC}"
    echo -e "  ${GREEN}1${NC})  Dev Tauri          ${DIM}Tauri + Vite hot reload${NC}"
    echo -e "  ${GREEN}2${NC})  Dev Web            ${DIM}Solo frontend en navegador${NC}"
    echo -e "  ${GREEN}3${NC})  Check              ${DIM}tsc + cargo check${NC}"
    echo -e "  ${GREEN}4${NC})  Tests              ${DIM}vitest run${NC}"
    echo ""
    echo -e "${BOLD} BUILD${NC}"
    echo -e "  ${YELLOW}5${NC})  Build release      ${DIM}App completa (NO_STRIP=true)${NC}"
    echo -e "  ${YELLOW}6${NC})  Build debug        ${DIM}Sin optimizaciones${NC}"
    echo -e "  ${YELLOW}7${NC})  Build frontend     ${DIM}Solo tsc + vite build${NC}"
    echo ""
    echo -e "${BOLD} GESTION${NC}"
    echo -e "  ${BLUE}8${NC})  Ejecutar app       ${DIM}Lanzar binario release${NC}"
    echo -e "  ${BLUE}9${NC})  Instalar deps      ${DIM}pnpm install${NC}"
    echo -e "  ${BLUE}10${NC}) Info proyecto      ${DIM}Versiones y estado${NC}"
    echo ""
    echo -e "${BOLD} STORAGE (IndexedDB / WebKit)${NC}"
    echo -e "  ${CYAN}11${NC}) Ver path storage  ${DIM}Ubicacion datos locales${NC}"
    echo -e "  ${RED}12${NC}) Reset storage     ${DIM}Borrar pacientes, sesiones, config${NC}"
    echo -e "  ${RED}13${NC}) Limpiar build     ${DIM}dist/ + cargo clean${NC}"
    echo ""
    echo -e "${BOLD} RELEASE${NC}"
    echo -e "  ${MAGENTA}14${NC}) Nuevo release     ${DIM}Bump version + tag + push${NC}"
    echo ""
    echo -e "  ${BOLD}0${NC})  Salir"
    echo ""
}

menu_loop() {
    while true; do
        show_banner
        show_menu

        echo -ne "${BOLD}  Opcion: ${NC}"
        read -r choice

        case "${choice// /}" in
            1)  cmd_dev;            pause_after ;;
            2)  cmd_dev_web;        pause_after ;;
            3)  cmd_check;          pause_after ;;
            4)  cmd_test;           pause_after ;;
            5)  cmd_build;          pause_after ;;
            6)  cmd_build_debug;    pause_after ;;
            7)  cmd_build_frontend; pause_after ;;
            8)  cmd_run;            pause_after ;;
            9)  cmd_install;        pause_after ;;
            10) cmd_info;           pause_after ;;
            11) cmd_storage_path;   pause_after ;;
            12) cmd_storage_reset;  pause_after ;;
            13) cmd_clean;          pause_after ;;
            14) cmd_release;        pause_after ;;
            0|q|salir) echo -e "\n${GREEN}Hasta luego${NC}"; exit 0 ;;
            "") ;;
            *)  error "Opcion no valida: $choice"; sleep 1 ;;
        esac
    done
}

# ── Ayuda CLI ────────────────────────────────────────────────────────────────
cmd_help() {
    echo -e "${BOLD}${MAGENTA}DIRD+ v$VERSION${NC}"
    echo -e "${DIM}Deteccion de Retinopatia Diabetica con IA Edge-Computing${NC}"
    echo ""
    echo -e "${BOLD}Uso:${NC} ./dird.sh [comando]"
    echo -e "     ./dird.sh          ${DIM}(menu interactivo)${NC}"
    echo ""
    echo "  dev             Tauri + Vite hot reload"
    echo "  dev:web         Solo frontend en navegador"
    echo "  check           tsc + cargo check"
    echo "  test            vitest run"
    echo "  build           Build release completo (NO_STRIP=true)"
    echo "  build:debug     Build debug"
    echo "  build:frontend  Solo frontend"
    echo "  run             Ejecutar binario release"
    echo "  install         pnpm install"
    echo "  info            Info del proyecto"
    echo "  storage:path    Ubicacion del storage local"
    echo "  storage:reset   Borrar storage local (IndexedDB + config)"
    echo "  clean           Limpiar dist/ + cargo clean"
    echo "  release         Nuevo release (bump + tag + push)"
    echo "  help            Esta ayuda"
}

# ── Router ───────────────────────────────────────────────────────────────────
main() {
    cd "$PROJECT_DIR"

    if [[ $# -eq 0 ]]; then
        menu_loop
        exit 0
    fi

    case "$1" in
        dev)            cmd_dev ;;
        dev:web)        cmd_dev_web ;;
        check)          cmd_check ;;
        test)           cmd_test ;;
        build)          cmd_build ;;
        build:debug)    cmd_build_debug ;;
        build:frontend) cmd_build_frontend ;;
        run)            cmd_run ;;
        install)        cmd_install ;;
        info)           cmd_info ;;
        storage:path)   cmd_storage_path ;;
        storage:reset)  cmd_storage_reset ;;
        clean)          cmd_clean ;;
        release)        cmd_release ;;
        help|--help|-h) cmd_help ;;
        *)              error "Comando desconocido: $1"; cmd_help; exit 1 ;;
    esac
}

main "$@"
