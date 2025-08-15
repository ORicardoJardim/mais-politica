import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import { AuthProvider } from './context/AuthContext'
import OrgProvider from './context/OrgContext' // <-- import novo

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <OrgProvider> {/* <-- wrapper novo */}
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </OrgProvider>
    </AuthProvider>
  </React.StrictMode>
)
