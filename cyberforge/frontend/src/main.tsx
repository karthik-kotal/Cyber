import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import 'leaflet/dist/leaflet.css';
import { LicenseProvider } from './context/LicenseContext';
import App from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Unable to find #root element in index.html');
}

createRoot(container).render(
  <StrictMode>
    <LicenseProvider>
      <App />
    </LicenseProvider>
  </StrictMode>,
);
