import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Settings, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfigStore } from '@/stores/config-store';
import { getAssetPath } from '@/utils/assets';
import { EncryptionBadge } from '@/components/layout/EncryptionBadge';

interface MainLayoutProps {
  children: React.ReactNode;
  fullScreenOnMobile?: boolean;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, fullScreenOnMobile = false }) => {
  const { t } = useTranslation();
  const location = useLocation();

  const navItems = [
    { path: '/patients', icon: Users, label: t('patients.title') },
    { path: '/reports', icon: FileText, label: t('reports.title') },
    { path: '/settings', icon: Settings, label: t('settings.title') },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-ice dark:bg-gray-900 dark:text-gray-100">
      {/* Header */}
      <header
        className={cn(
          "text-white shadow-strong dark:bg-gray-800",
          fullScreenOnMobile ? "hidden xl:block" : ""
        )}
        style={{ backgroundColor: useConfigStore().config.appearance.primaryColor }}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and title */}
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center dark:bg-gray-700">
                <img
                  src={getAssetPath(useConfigStore().config.appearance.logo)}
                  alt="Logo"
                  className="w-6 h-6 object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold">{t('app.name')}</h1>
                <p className="text-xs text-primary-100 dark:text-gray-300">{t('app.tagline')}</p>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <EncryptionBadge />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav 
        className={cn(
          "bg-white border-b border-coal-200 shadow-light dark:bg-gray-800 dark:border-gray-700 overflow-x-auto scrollbar-hide",
          fullScreenOnMobile ? "hidden xl:block" : ""
        )}
      >
        <div className="container mx-auto px-4">
          <div className="flex space-x-1 min-w-max">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors relative',
                    isActive
                      ? 'dark:border-blue-400 dark:text-blue-300'
                      : 'border-transparent text-smoke-600 hover:text-coal-800 hover:border-coal-300 dark:text-gray-200 dark:hover:text-gray-100 dark:hover:border-gray-600'
                  )}
                  style={{
                    borderColor: isActive ? useConfigStore().config.appearance.primaryColor : undefined,
                    color: isActive ? useConfigStore().config.appearance.primaryColor : undefined
                  }}
                >
                  <div className="relative">
                    <Icon className="w-4 h-4 dark:text-gray-200" />
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main
        className={cn(
          "flex-grow dark:bg-gray-900",
          fullScreenOnMobile
            ? "xl:container xl:mx-auto xl:px-4 xl:py-6"
            : "container mx-auto px-4 py-6"
        )}
      >
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
