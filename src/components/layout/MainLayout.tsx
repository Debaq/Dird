import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfigStore } from '@/stores/config-store';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const location = useLocation();

  const navItems = [
    { path: '/patients', icon: Users, label: t('patients.title') },
    { path: '/settings', icon: Settings, label: t('settings.title') },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-ice dark:bg-gray-900 dark:text-gray-100">
      {/* Header */}
      <header
        className="text-white shadow-strong dark:bg-gray-800"
        style={{ backgroundColor: useConfigStore().config.appearance.primaryColor }}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center dark:bg-gray-700">
                <img
                  src={useConfigStore().config.appearance.logo}
                  alt="Logo"
                  className="w-6 h-6 object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold">{t('app.name')}</h1>
                <p className="text-xs text-primary-100 dark:text-gray-300">{t('app.tagline')}</p>
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-coal-200 shadow-light dark:bg-gray-800 dark:border-gray-700 overflow-x-auto scrollbar-hide">
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
                    'flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors',
                    isActive
                      ? 'dark:border-blue-400 dark:text-blue-300'
                      : 'border-transparent text-smoke-600 hover:text-coal-800 hover:border-coal-300 dark:text-gray-200 dark:hover:text-gray-100 dark:hover:border-gray-600'
                  )}
                  style={{
                    borderColor: isActive ? useConfigStore().config.appearance.primaryColor : undefined,
                    color: isActive ? useConfigStore().config.appearance.primaryColor : undefined
                  }}
                >
                  <Icon className="w-4 h-4 dark:text-gray-200" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-6 dark:bg-gray-900">{children}</main>

      {/* Footer */}
      <footer className="bg-white border-t border-coal-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
        <div className="container mx-auto px-4 py-4">
          <p className="text-center text-sm text-smoke-500 dark:text-gray-400">
            {t('app.name')} - Privacy-first medical imaging analysis
          </p>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
