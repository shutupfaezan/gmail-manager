import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import GmailSendersList from './components/GmailSendersList';

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
        {/* A catch-all route to redirect any other path to the root for re-evaluation. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
