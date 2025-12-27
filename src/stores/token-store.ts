import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TokenStore {
  tokens: number;
  lastFetch: number | null;
  setTokens: (tokens: number) => void;
  decrementTokens: () => void;
  resetTokens: () => void;
}

export const useTokenStore = create<TokenStore>()(
  persist(
    (set) => ({
      tokens: 0,
      lastFetch: null,
      setTokens: (tokens) => set({ tokens, lastFetch: Date.now() }),
      decrementTokens: () => set((state) => ({ tokens: Math.max(0, state.tokens - 1) })),
      resetTokens: () => set({ tokens: 0, lastFetch: null }),
    }),
    {
      name: 'dird-tokens',
    }
  )
);
