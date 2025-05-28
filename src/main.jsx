import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId="866445433315-55r5testdu72bsgm41rosgep2al6nkuj.apps.googleusercontent.com">
  <StrictMode>
    <App />
  </StrictMode>,
  </GoogleOAuthProvider>
)
