import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DataProvider } from './services/store';
import { AudioProvider } from './audio/AudioProvider';
import { ToastProvider } from './components/Toast';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataProvider>
      <AudioProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AudioProvider>
    </DataProvider>
  </StrictMode>,
);
