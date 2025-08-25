import React from "react";
import { useNavigate } from "react-router-dom";
import mailIcon from '../assets/mail_icon.png';

const Header = () => {
  const navigate = useNavigate();
  return (
    <div className="d-flex align-items-center py-3 bg-white shadow-sm justify-content-center">
      <img
        src={mailIcon}
        alt="Gmail logo"
        style={{ width: '30px', height: '30px', marginRight: '8px', cursor: 'pointer' }}
        onClick={() => navigate('/gmail-all-senders')}
      />
      <span style={{ fontSize: '18px', fontWeight: '600', color: 'black' }}>Gmail Unsubscriber</span>
    </div>
  );
};

export default Header;
