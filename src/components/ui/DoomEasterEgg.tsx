import { useState } from 'react';
import { useKonamiCode } from '@/hooks/useKonamiCode';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';

export function DoomEasterEgg() {
  const [isOpen, setIsOpen] = useState(false);

  useKonamiCode(() => {
    setIsOpen(true);
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {isOpen && (
        <DialogContent className="max-w-[90vw] w-[800px] h-[600px] bg-zinc-900 border-2 border-primary-500 p-0 overflow-hidden flex flex-col shadow-2xl">
          <div className="flex items-center justify-between p-2 bg-zinc-800 border-b border-primary-900">
             <div className="flex items-center gap-2">
                <span className="text-primary-500 font-mono font-bold animate-pulse">RETRO.EXE</span>
                <span className="text-xs text-zinc-500 font-mono">Running...</span>
             </div>
             <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-white transition-colors"
             >
                <X size={20} />
             </button>
          </div>

          <div className="flex-1 bg-black relative">
            <iframe
              src="/retro-game.html"
              className="absolute inset-0 w-full h-full border-0"
              allowFullScreen
              title="Retro Game"
            />
          </div>
          <div className="bg-zinc-800 p-1 text-center">
             <p className="text-[10px] text-zinc-500 font-mono">
                Controls: Arrows (Move) • Ctrl (Fire) • Space (Open)
             </p>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
