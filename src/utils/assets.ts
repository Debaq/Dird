/**
 * Utility to get the correct asset path considering the base path in production.
 */
export const getAssetPath = (path: string): string => {
  if (!path) return '';
  
  // If it's already a full URL or a data/blob URI, return it as is
  if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }

  const baseUrl = import.meta.env.BASE_URL || '/';
  
  // Clean the path (remove leading slash if present)
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Ensure baseUrl ends with a slash
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  
  return `${normalizedBase}${cleanPath}`;
};
