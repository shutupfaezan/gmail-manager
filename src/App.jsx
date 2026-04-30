import { useState } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import GmailSendersList from './components/GmailSendersList';
import Footer from './components/Footer';
import Header from './components/Header';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';

const ProtectedRoute = ({ children }) => {
    const token = sessionStorage.getItem('googleAccessToken');
    if (!token) return <Navigate to="/login" replace />;
    return children;
};

const RootRedirect = () => {
    const token = sessionStorage.getItem('googleAccessToken');
    return token ? <Navigate to="/gmail-all-senders" replace /> : <Navigate to="/login" replace />;
};

function App() {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <BrowserRouter>
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
                <Header searchQuery={searchQuery} onSearchChange={setSearchQuery}/>
                <Routes>
                    <Route path="/" element={<RootRedirect />} />
                    <Route path="/login" element={<Login />} />
                    <Route
                        path="/gmail-all-senders"
                        element={
                            <ProtectedRoute>
                                <GmailSendersList searchQuery={searchQuery}/>
                            </ProtectedRoute>
                        }
                    />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/terms-of-service" element={<TermsOfService />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <Footer />
            </div>
        </BrowserRouter>
    );
}

export default App;
