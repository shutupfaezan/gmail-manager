import { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate, Link } from 'react-router-dom';
import GIcon from '../assets/G_icon.png';

function Login() {
    const [loginError, setLoginError] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (sessionStorage.getItem('googleAccessToken')) {
            navigate('/gmail-all-senders');
        }
    }, [navigate]);

    const handleGoogleLoginSuccess = (tokenResponse) => {
        if (tokenResponse.access_token) {
            sessionStorage.setItem('googleAccessToken', tokenResponse.access_token);
            setLoginError(null);
        } else {
            setLoading(false);
            setLoginError('Failed to retrieve access token. Please try again.');
            return;
        }
        navigate('/gmail-all-senders');
    };

    const handleGoogleLoginError = () => {
        setLoading(false);
        setLoginError('Login failed. Please try again.');
    };

    const login = useGoogleLogin({
        onSuccess: handleGoogleLoginSuccess,
        onError: handleGoogleLoginError,
        flow: 'implicit',
        scope: 'email https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic',
    });

    const handleLogin = () => {
        setLoading(true);
        setLoginError(null);
        login();
    };

    return (
        <div className="dots" style={{
            minHeight: '100vh',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 20,
        }}>
            <div className="fu" style={{
                width: '100%', maxWidth: 440,
                background: 'white',
                borderRadius: 'var(--r-xl)',
                boxShadow: 'var(--sh-lg)',
                padding: '40px 28px',
                textAlign: 'center',
            }}>
                {/* Icon */}
                <div style={{
                    width: 64, height: 64, borderRadius: 18,
                    background: 'linear-gradient(135deg,#6366f1,#818cf8)',
                    margin: '0 auto 20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(99,102,241,.3)',
                }}>
                    <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                        <path d="M3 9l12 8 12-8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                        <rect x="2" y="7" width="26" height="18" rx="3" stroke="white" strokeWidth="2.5"/>
                    </svg>
                </div>

                <h1 style={{
                    fontSize: 26, fontWeight: 800,
                    letterSpacing: '-.5px', marginBottom: 8,
                    color: 'var(--text)',
                }}>
                    Clean your inbox.
                </h1>
                <p style={{
                    fontSize: 14, color: 'var(--text-2)',
                    lineHeight: 1.6, marginBottom: 28,
                    maxWidth: 300, margin: '0 auto 28px',
                }}>
                    Find and remove bulk senders from Gmail in minutes.
                </p>

                {/* Sign in button */}
                <button
                    onClick={handleLogin}
                    disabled={loading}
                    style={{
                        width: '100%', height: 50, borderRadius: 'var(--r)',
                        border: '1.5px solid var(--border)',
                        background: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        fontSize: 15, fontWeight: 700, color: 'var(--text)',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                        boxShadow: 'var(--sh-sm)',
                        opacity: loading ? .65 : 1,
                        transition: 'all .2s',
                    }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow = 'var(--sh-md)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--sh-sm)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                    {loading ? (
                        <>
                            <svg style={{ animation: 'spin 1s linear infinite' }} width="18" height="18" viewBox="0 0 18 18" fill="none">
                                <circle cx="9" cy="9" r="7" stroke="#e2e8f0" strokeWidth="2.5"/>
                                <path d="M9 2a7 7 0 017 7" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round"/>
                            </svg>
                            Connecting…
                        </>
                    ) : (
                        <>
                            <img src={GIcon} alt="Google" style={{ width: 22, height: 22 }}/>
                            Sign in with Google
                        </>
                    )}
                </button>

                {/* Trust pills */}
                <div style={{
                    display: 'flex', flexWrap: 'wrap',
                    justifyContent: 'center', gap: 8, marginTop: 24,
                }}>
                    {[['🔒', 'Client-side'], ['📭', 'No storage'], ['✅', 'Google auth']].map(([icon, label]) => (
                        <div key={label} style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 12px', borderRadius: 'var(--r-full)',
                            background: 'var(--border-light)',
                            fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
                        }}>
                            <span>{icon}</span>{label}
                        </div>
                    ))}
                </div>

                {loginError && (
                    <div style={{
                        marginTop: 20, padding: '12px 16px',
                        background: '#fef2f2', borderRadius: 'var(--r)',
                        border: '1px solid #fecaca',
                        color: '#991b1b', fontSize: 13, fontWeight: 600,
                    }}>
                        {loginError}
                    </div>
                )}
            </div>

            <p style={{ marginTop: 16, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
                By signing in you agree to our{' '}
                <Link to="/terms-of-service" style={{ color: 'var(--primary)' }}>Terms</Link>
                {' '}&amp;{' '}
                <Link to="/privacy-policy" style={{ color: 'var(--primary)' }}>Privacy</Link>
            </p>
        </div>
    );
}

export default Login;
