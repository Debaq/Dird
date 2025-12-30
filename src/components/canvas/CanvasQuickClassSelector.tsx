import React from 'react';
import { useTranslation } from 'react-i18next';

interface QuickClassSelectorProps {
  availableClasses: Array<{ name: string; displayName: string; color: string }>;
  preSelectedClass: string | null;
  onSelectClass: (className: string | null) => void;
}

export const CanvasQuickClassSelector: React.FC<QuickClassSelectorProps> = ({
  availableClasses,
  preSelectedClass,
  onSelectClass,
}) => {
  const { t } = useTranslation();

  return (
    <div className="absolute top-14 left-2 z-10 bg-white rounded-lg shadow-lg border border-coal-200 p-1.5 max-w-xs">
      <div className="text-[9px] font-semibold text-coal-600 mb-1 uppercase tracking-wider px-1">
        {t('canvas.quickClassSelection') || 'Quick Class Selection'}
      </div>
      <div className="space-y-0.5">
        {availableClasses.map((cls, index) => {
          // Get shortcut key: 1-9 for indices 0-8, q,w,e,r,t,y,u,i,o,p for indices 9-18
          const shortcutKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
          const shortcutKey = index < 19 ? shortcutKeys[index] : '';
          const isSelected = preSelectedClass === cls.name;
          return (
            <button
              key={cls.name}
              onClick={() => onSelectClass(isSelected ? null : cls.name)}
              className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-primary-100 border border-primary-500 text-primary-700 shadow-sm'
                  : 'hover:bg-coal-50 border border-transparent text-coal-700'
              }`}
              title={shortcutKey ? `Press ${shortcutKey} to select` : cls.displayName}
            >
              {shortcutKey && (
                <span className="font-mono font-bold text-[9px] text-coal-500 min-w-[16px]">
                  [{shortcutKey}]
                </span>
              )}
              <div
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: cls.color }}
              />
              <span className="flex-1 truncate leading-tight">{cls.displayName}</span>
            </button>
          );
        })}
      </div>
      {preSelectedClass && (
        <div className="mt-1 pt-1 border-t border-coal-200">
          <div className="text-[9px] text-primary-600 px-1">
            {t('canvas.classPreSelected') || 'Next annotation will be:'}{' '}
            <span className="font-semibold">
              {availableClasses.find(c => c.name === preSelectedClass)?.displayName}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
