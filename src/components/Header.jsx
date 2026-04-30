import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SynapseLogo from '../assets/Synapse_logo_NBG.png';

const SearchIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
);

const LogoutIcon = () => (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M5 2.5H3a1 1 0 00-1 1v8a1 1 0 001 1h2M10 10.5l3-3-3-3M13 7.5H5.5"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const Header = ({ searchQuery, onSearchChange }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchOpen, setSearchOpen] = useState(false);

    const isLoggedIn = !!sessionStorage.getItem('googleAccessToken');
    const showSearch = isLoggedIn && location.pathname === '/gmail-all-senders';

    const handleLogout = () => {
        sessionStorage.removeItem('googleAccessToken');
        navigate('/login');
    };

    return (
        <header style={{
            position: 'sticky', top: 0, zIndex: 200,
            background: 'rgba(255,255,255,.9)',
            backdropFilter: 'blur(14px)',
            borderBottom: '1px solid rgba(226,232,240,.7)',
        }}>
            <div style={{
                height: 'var(--header-h)',
                display: 'flex', alignItems: 'center',
                padding: '0 16px', gap: 10,
                maxWidth: 720, margin: '0 auto', width: '100%',
            }}>
                {/* Logo */}
                <div style={{ flexShrink: 0, cursor: 'pointer' }}
                    onClick={() => isLoggedIn && navigate('/gmail-all-senders')}>
                    <img src={SynapseLogo} alt="Synapse"
                        style={{ height: 28, width: 'auto', objectFit: 'contain', display: 'block' }}/>
                </div>

                <div style={{ flex: 1 }}/>

                {/* Search toggle */}
                {showSearch && (
                    <button onClick={() => setSearchOpen(o => !o)}
                        style={{
                            width: 36, height: 36, borderRadius: 10,
                            border: '1px solid var(--border)', background: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: searchOpen ? 'var(--primary)' : 'var(--text-2)', cursor: 'pointer',
                            transition: 'all .15s',
                            borderColor: searchOpen ? 'var(--primary)' : 'var(--border)',
                        }}>
                        <SearchIcon/>
                    </button>
                )}

                {/* Logout */}
                {isLoggedIn && (
                    <button onClick={handleLogout}
                        style={{
                            height: 36, padding: '0 12px', borderRadius: 10,
                            border: '1px solid var(--border)', background: 'white',
                            color: 'var(--text-2)', fontSize: 13, fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: 6,
                            transition: 'all .15s',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--danger)';
                            e.currentTarget.style.color = 'var(--danger)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.color = 'var(--text-2)';
                        }}>
                        <LogoutIcon/>
                        <span style={{ display: 'none' }} className="md-show">Sign out</span>
                    </button>
                )}
            </div>

            {/* Expandable search bar */}
            {showSearch && searchOpen && (
                <div className="fu" style={{
                    padding: '0 16px 12px',
                    borderTop: '1px solid var(--border-light)',
                    maxWidth: 720, margin: '0 auto', width: '100%',
                }}>
                    <div style={{ position: 'relative' }}>
                        <span style={{
                            position: 'absolute', left: 12, top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-3)', pointerEvents: 'none',
                        }}>
                            <SearchIcon/>
                        </span>
                        <input
                            autoFocus
                            value={searchQuery || ''}
                            onChange={e => onSearchChange && onSearchChange(e.target.value)}
                            placeholder="Search senders…"
                            style={{
                                width: '100%', height: 40, borderRadius: 'var(--r-full)',
                                border: '1.5px solid var(--border)',
                                paddingLeft: 36, paddingRight: 36,
                                fontSize: 14, fontFamily: 'inherit',
                                outline: 'none', background: 'white', color: 'var(--text)',
                                transition: 'border-color .15s',
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border)'}
                        />
                        {searchQuery && (
                            <button onClick={() => onSearchChange && onSearchChange('')}
                                style={{
                                    position: 'absolute', right: 10, top: '50%',
                                    transform: 'translateY(-50%)',
                                    border: 'none', background: 'none', cursor: 'pointer',
                                    color: 'var(--text-3)', fontSize: 16, lineHeight: 1,
                                }}>✕</button>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;
