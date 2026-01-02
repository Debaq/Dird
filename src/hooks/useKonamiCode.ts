import { useEffect, useState } from 'react';

const KONAMI_CODE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

export function useKonamiCode(onSuccess: () => void) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      const requiredKey = KONAMI_CODE[index];

      if (key === requiredKey) {
        if (index === KONAMI_CODE.length - 1) {
          onSuccess();
          setIndex(0);
        } else {
          setIndex((prev) => prev + 1);
        }
      } else {
        setIndex(0);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [index, onSuccess]);
}
