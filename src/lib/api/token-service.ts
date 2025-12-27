/**
 * Token Service - Handles token-related API calls
 */

const API_BASE_URL = import.meta.env.PROD
  ? 'https://dird.debaq.dev/backend'
  : 'http://localhost:8000/backend';

interface TokenResponse {
  success: boolean;
  tokens: number;
  timestamp: number;
}

interface ConsumeTokenResponse {
  success: boolean;
  message: string;
  remainingTokens: number;
  timestamp: number;
}

/**
 * Fetch available tokens from the server
 */
export async function fetchTokens(): Promise<number> {
  try {
    const response = await fetch(`${API_BASE_URL}/get_tokens.php`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: TokenResponse = await response.json();

    if (!data.success) {
      throw new Error('Failed to fetch tokens');
    }

    return data.tokens;
  } catch (error) {
    console.error('Error fetching tokens:', error);
    // Return 0 if there's an error
    return 0;
  }
}

/**
 * Consume a token when generating a report
 */
export async function consumeToken(): Promise<number> {
  try {
    const response = await fetch(`${API_BASE_URL}/consume_token.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'consume',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ConsumeTokenResponse = await response.json();

    if (!data.success) {
      throw new Error('Failed to consume token');
    }

    return data.remainingTokens;
  } catch (error) {
    console.error('Error consuming token:', error);
    throw error;
  }
}
