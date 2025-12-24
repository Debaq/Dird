// src/utils/version.ts
import { getAssetPath } from './assets';

export interface VersionInfo {
  version: string;
  timestamp: number;
  buildNumber: number;
}

/**
 * Genera un número de versión basado en el timestamp
 * @returns Objeto con información de versión
 */
export const generateVersionInfo = (): VersionInfo => {
  const timestamp = Date.now();
  const version = `build-${timestamp}`;

  return {
    version,
    timestamp,
    buildNumber: timestamp
  };
};

/**
 * Obtiene la información de versión desde el archivo version.json
 * @param bustCache - Si es true, agrega un timestamp para evitar el cache del navegador
 * @returns Promise con información de versión
 */
export const getCurrentVersion = async (bustCache = false): Promise<VersionInfo> => {
  try {
    const url = getAssetPath('/version.json');
    const cacheBuster = bustCache ? `?t=${Date.now()}` : '';
    const response = await fetch(`${url}${cacheBuster}`, {
      cache: bustCache ? 'no-cache' : 'default'
    });
    if (response.ok) {
      return await response.json();
    } else {
      // Si no existe el archivo, generamos una versión por defecto
      return {
        version: 'unknown',
        timestamp: 0,
        buildNumber: 0
      };
    }
  } catch (error) {
    console.warn('No se pudo cargar el archivo de versión:', error);
    return {
      version: 'unknown',
      timestamp: 0,
      buildNumber: 0
    };
  }
};