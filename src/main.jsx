import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { MarketProvider } from './contexts/MarketContext.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MarketProvider>
      <App />
    </MarketProvider>
  </React.StrictMode>
);
