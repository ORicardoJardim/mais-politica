// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import './styles.css'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import OrgProvider from './context/OrgContext'  // default import

const rootEl = document.getElementById('root')
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <OrgProvider>
          <App />
        </OrgProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)