import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const DocumentTitleSync = () => {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const updateTitle = () => {
      const appName = t('app.name');
      const appTagline = t('app.tagline');
      document.title = `${appName} - ${appTagline}`;
    };

    // Update title immediately
    updateTitle();

    // Update title when language changes
    const handleLanguageChange = () => {
      updateTitle();
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [t, i18n]);

  return null; // This component doesn't render anything
};

export default DocumentTitleSync;