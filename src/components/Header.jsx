import React from "react";
import { useNavigate } from "react-router-dom";
import SynapseLogo from '../assets/Synapse_logo_NBG.png';

const Header = () => {
  const navigate = useNavigate();
  return (
    <div className="d-flex align-items-center py-3 bg-white shadow-sm justify-content-center">
      <img
        src={SynapseLogo}
        alt="Synapse logo"
        style={{ height: '30px', width: '210px', objectFit: 'cover', cursor: 'pointer', display: 'block' }}
        onClick={() => navigate('/gmail-all-senders')}
      />
    </div>
  );
};

export default Header;
