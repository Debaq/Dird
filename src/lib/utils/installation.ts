/**
 * Installation Token Management
 * Generates and stores a unique installation token for this DIRD instance
 */

const INSTALLATION_TOKEN_KEY = 'dird-installation-token';

/**
 * Generate a simple UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get or create installation token
 * This token uniquely identifies this DIRD installation
 */
export function getInstallationToken(): string {
  let token = localStorage.getItem(INSTALLATION_TOKEN_KEY);

  if (!token) {
    token = generateUUID();
    localStorage.setItem(INSTALLATION_TOKEN_KEY, token);
    console.log('🔑 New installation token created:', token);
  }

  return token;
}

/**
 * Reset installation token (for testing purposes)
 */
export function resetInstallationToken(): void {
  localStorage.removeItem(INSTALLATION_TOKEN_KEY);
  console.log('🔑 Installation token reset');
}
