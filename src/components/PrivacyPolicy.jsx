import React from "react";
import "./LegalPages.css";

const PrivacyPolicy = () => (
  <div className="legal-page-container">
    <h1>Privacy Policy</h1>
    <p>Last updated: August 25, 2025</p>
    <p>
      This Privacy Policy describes how your information is collected, used, and shared when you use the Gmail Spam Manager app ("the App").
    </p>
    <h2>Information We Collect</h2>
    <ul>
      <li>We access your Gmail account only with your explicit consent via Google OAuth.</li>
      <li>We do not store your emails, contacts, or any personal data on our servers.</li>
      <li>All processing is done client-side in your browser.</li>
    </ul>
    <h2>How We Use Your Information</h2>
    <ul>
      <li>To analyze and manage your Gmail spam and senders as requested by you.</li>
      <li>We do not use your data for advertising or share it with third parties.</li>
    </ul>
    <h2>Third-Party Services</h2>
    <p>
      The App uses Google APIs to access your Gmail data. Please review Google’s privacy policy for more information.
    </p>
    <h2>Your Choices</h2>
    <ul>
      <li>You can revoke the App’s access to your Gmail account at any time from your Google Account settings.</li>
    </ul>
    <h2>Contact Us</h2>
    <p>
      If you have questions about this Privacy Policy, please contact us at <a href="mailto:faezanmakani13@gmail.com">faezanmakani13@gmail.com</a>.
    </p>
  </div>
);

export default PrivacyPolicy;
