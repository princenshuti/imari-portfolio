import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { MarketProvider } from './contexts/MarketContext.jsx';
import './styles.css';

// I18nProvider is mounted inside App.jsx (it needs access to state.profile)
// so locale changes can persist to the cloud-synced profile.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MarketProvider>
      <App />
    </MarketProvider>
  </React.StrictMode>
);
