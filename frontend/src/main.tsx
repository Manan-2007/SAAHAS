import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AuthGate} from './auth/AuthProvider';
import {LanguageProvider} from './i18n/LanguageProvider';
import {ThemeProvider} from './theme';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <AuthGate>
          <App />
        </AuthGate>
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
);
