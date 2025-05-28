import React, { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google'; // Revert to useGoogleLogin for access token
import GmailSendersList from './GmailSendersList';
import { jwtDecode } from 'jwt-decode';

function Login() {
    const [accessToken, setAccessToken] = useState(null);
    const [loginError, setLoginError] = useState(null);

    // This handler is designed for a TokenResponse, which implicit flow provides
    // and useGoogleLogin with flow: 'implicit' will provide this.
    const handleGoogleLoginSuccess = (tokenResponse) => {
        console.log("Google Login Success (from useGoogleLogin):", tokenResponse);
        if (tokenResponse.access_token) {
            setAccessToken(tokenResponse.access_token);
            setLoginError(null);
            console.log("Access Token set:", tokenResponse.access_token);

            // The tokenResponse from useGoogleLogin (implicit flow) might also contain an id_token
            // if 'openid', 'email', or 'profile' scopes were included.
            // Your scope "email https://www.googleapis.com/auth/gmail.readonly" includes "email",
            // which implies openid, profile, email.
            if (tokenResponse.id_token) {
                const decodedIdToken = jwtDecode(tokenResponse.id_token);
                console.log("Decoded ID Token (for user info):", decodedIdToken);
                // You can use decodedIdToken.email, decodedIdToken.name, etc.
            }
        } else {
            console.error("Access token not found in tokenResponse from useGoogleLogin.", tokenResponse);
            setLoginError("Failed to retrieve access token. Check console for details.");
            setAccessToken(null);
        }
    };

    const handleGoogleLoginError = (error) => {
        console.error("Google Login Failed (from useGoogleLogin): ", error);
        setLoginError("Login failed. Please try again.");
        setAccessToken(null);
    };

    const login = useGoogleLogin({
        onSuccess: handleGoogleLoginSuccess,
        onError: handleGoogleLoginError,
        flow: 'implicit', // Ensures the token is returned to the client
        scope: 'email https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic', // Added scope for filters
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
            <h1>Gmail Spam Manager</h1>
            {!accessToken ? (
                <div style={{ marginTop: '20px' }}>
                    {/* You can style this button to look like Google's official button */}
                    <button 
                        onClick={() => login()} 
                        style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
                    >
                        {/* You can use an SVG icon for the Google logo here */}
                        Sign in with Google
                    </button>
                </div>
            ) : (
                <GmailSendersList accessToken={accessToken} />
            )}
            {loginError && <p style={{ color: 'red' }}>{loginError}</p>}
        </div>
    );
}

export default Login;