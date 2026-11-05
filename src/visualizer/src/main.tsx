/**
 * @file main.tsx
 * Mount point for TIME 2.0 Visual Diagnostic Application.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './styles/visualizer.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element #root');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
