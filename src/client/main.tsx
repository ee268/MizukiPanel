import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { PanelThemeProvider } from './theme';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PanelThemeProvider>
      <BrowserRouter><App /></BrowserRouter>
    </PanelThemeProvider>
  </React.StrictMode>
);
