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
    { path: '/settings', icon: Settings, label: 'Configuración' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-ice">
      {/* Header */}
      <header className="bg-primary-500 text-white shadow-strong">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <img
                  src={useConfigStore().config.appearance.logo}
                  alt="Logo"
                  className="w-6 h-6 object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold">{t('app.name')}</h1>
                <p className="text-xs text-primary-100">{t('app.tagline')}</p>
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-coal-200 shadow-light">
        <div className="container mx-auto px-4">
          <div className="flex space-x-1">
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
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-smoke-600 hover:text-coal-800 hover:border-coal-300'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-6">{children}</main>

      {/* Footer */}
      <footer className="bg-white border-t border-coal-200">
        <div className="container mx-auto px-4 py-4">
          <p className="text-center text-sm text-smoke-500">
            {t('app.name')} - Privacy-first medical imaging analysis
          </p>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
