

import { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import 'bootstrap/dist/css/bootstrap.min.css'; // Keep this for Bootstrap classes
import { useNavigate } from 'react-router-dom';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faShieldAlt, faDatabase, faQuestionCircle, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'; // Import necessary icons

import mailIcon from '../assets/mail_icon.png';
import GIcon from '../assets/G_icon.png';

function Login() {
    const [loginError, setLoginError] = useState(null);
    const [openAccordionItem, setOpenAccordionItem] = useState(null); // State to manage open/close FAQ items
    const navigate = useNavigate();

    // If a token already exists, redirect to the main app page
    useEffect(() => {
        if (sessionStorage.getItem('googleAccessToken')) {
            navigate('/gmail-all-senders');
        }
    }, [navigate]);

    const handleGoogleLoginSuccess = (tokenResponse) => {
        if (tokenResponse.access_token) {
            sessionStorage.setItem('googleAccessToken', tokenResponse.access_token);
            setLoginError(null);

            if (tokenResponse.id_token) {
                const decodedIdToken = jwtDecode(tokenResponse.id_token);
            }
        } else {
            console.error("Access token not found in tokenResponse from useGoogleLogin.", tokenResponse);
            setLoginError("Failed to retrieve access token. Check console for details.");
        }
        // Navigate to the main application view on success
        navigate('/gmail-all-senders');
    };

    const handleGoogleLoginError = (error) => {
        console.error("Google Login Failed (from useGoogleLogin): ", error);
        setLoginError("Login failed. Please try again.");
    };

    const login = useGoogleLogin({
        onSuccess: handleGoogleLoginSuccess,
        onError: handleGoogleLoginError,
        flow: 'implicit',
        scope: 'email https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic',
    });

    const toggleAccordion = (itemKey) => {
        setOpenAccordionItem(openAccordionItem === itemKey ? null : itemKey);
    };

    return (
    <div className="d-flex flex-column bg-light" style={{ minHeight: '100vh' }}>
        {/* Main Content Card */}
        <div className="flex-fill d-flex align-items-center justify-content-center">                
            <div className="p-4 " style={{ maxWidth: '600px', width: '100%', borderColor: '#e0e0e0' }}>
                <div className="card-body text-center">
                    <img src={GIcon} alt="Google G" style={{ width: '48px', height: '48px', marginBottom: '16px' }} />
                    <h2 className="mb-3" style={{fontWeight: 700}}>Connect Your Gmail to Begin</h2>
                    <p className="text-muted mb-4">
                        This will let us use the necessary data to help you remove unnecessary emails and manage your subscriptions effectively.
                    </p>
                    <div className="mb-4">
                        <button
                            onClick={() => login()}
                            className="btn btn-outline-secondary d-flex align-items-center justify-content-center mx-auto"
                            style={{
                                padding: '10px 24px',
                                fontWeight: '500',
                                fontSize: '16px',
                                borderColor: '#dadce0',
                                color: '#3c4043',
                                backgroundColor: '#fff'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f7f8f8'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                        >
                                                        <img
                                src={GIcon}
                                alt="Google logo"
                                style={{ width: '20px', height: '20px', marginRight: '12px' }}
                            />
                            Sign in with Google
                        </button>
                        <p className="text-muted mt-2" style={{ fontSize: '0.85rem' }}>Secure authentication powered by Google</p>
                    </div>
                    {loginError && <p className="text-danger mt-3">{loginError}</p>}
                </div>
            </div>
        </div>
    </div>
    );
}

export default Login;