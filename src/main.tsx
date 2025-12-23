import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n/config';
import App from './App';
import { useTheme } from './hooks/useTheme';

function AppWithTheme() {
  useTheme();

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWithTheme />
  </StrictMode>,
);
