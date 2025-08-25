import React from "react";
import "./Footer.css";
import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="footer-container">
    <div className="footer-links">
      <Link to="/privacy-policy">Privacy Policy</Link>
      <span className="footer-separator">|</span>
      <Link to="/terms-of-service">Terms of Service</Link>
    </div>
    <div className="footer-copy">
      &copy; {new Date().getFullYear()} Gmail Spam Manager. All rights reserved.
    </div>
  </footer>
);

export default Footer;
