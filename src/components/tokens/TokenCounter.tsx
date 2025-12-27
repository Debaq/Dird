import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TokenCounterProps {
  tokens: number;
  className?: string;
}

/**
 * Token counter component for displaying available tokens/credits
 * Used in the header to show user's remaining tokens for report generation
 */
const TokenCounter: React.FC<TokenCounterProps> = ({
  tokens,
  className
}) => {
  const hasTokens = tokens > 0;
  const Icon = hasTokens ? Eye : EyeOff;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all bg-white/10 hover:bg-white/20 backdrop-blur-sm",
        className
      )}
    >
      <Icon className="w-5 h-5 text-yellow-500" />
      <span className="font-bold text-lg tabular-nums text-white">
        {tokens}
      </span>
    </div>
  );
};

export default TokenCounter;
