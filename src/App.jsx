import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import GmailSendersList from './components/GmailSendersList';
import Footer from './components/Footer';
import Header from './components/Header';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';

// A component to protect routes that require authentication.
// It checks for an access token in sessionStorage.
const ProtectedRoute = ({ children }) => {
  const token = sessionStorage.getItem('googleAccessToken');
  if (!token) {
    // If no token is found, redirect the user to the login page.
    return <Navigate to="/login" replace />;
  }
  // If a token is found, render the child component (the protected page).
  return children;
};

// This component handles the initial routing logic.
// It checks for an access token and redirects the user to the appropriate page.
const RootRedirect = () => {
  const token = sessionStorage.getItem('googleAccessToken');
  return token ? <Navigate to="/gmail-all-senders" replace /> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter basename="/gmail-manager">
      <div style={{ minHeight: '100vh', position: 'relative'}}>
        <Header />
        <Routes>
          {/* The root path now intelligently redirects based on authentication status. */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/gmail-all-senders"
            element={
              <ProtectedRoute>
                <GmailSendersList />
              </ProtectedRoute>
            }
          />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          {/* A catch-all route to redirect any other path to the root for re-evaluation. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App
