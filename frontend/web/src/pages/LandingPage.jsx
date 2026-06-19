import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import sbsiLogo from '@/assets/SBSI.png';
import heroBg from '@/assets/SBSI-bg.png';

const styles = `
.lp-wrap {
  font-family: 'Poppins', 'Montserrat', sans-serif;
  background: #07071a;
  color: #fff;
  overflow-x: hidden;
}
.nav {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 100;
  background: rgba(14, 14, 46, 0.7);
  backdrop-filter: blur(16px);
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.08);
}
.nav-inner {
  max-width: 1300px;
  height: 64px;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.nav-logo img {
  height: 60px;
  object-fit: contain;
}
.btn-login {
  text-decoration: none;
  border-radius: 8px;
  padding: 9px 22px;
  background: #2e85d8;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}
.hero {
  position: relative;
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  overflow: hidden;
}
.hero-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to right,
    rgba(14, 14, 46, 0.90) 0%,
    rgba(14, 14, 46, 0.60) 30%,
    rgba(14, 14, 46, 0.60) 70%,
    rgba(14, 14, 46, 0.90) 100%
  );
}
.hero-content {
  position: relative;
  z-index: 2;
  max-width: 1440px;
  margin: 0 auto;
  padding: 100px 40px 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 28px;
  padding: 6px 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 0.5px solid rgba(255, 255, 255, 0.18);
  border-radius: 20px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
}
.badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4ade80;
}
.hero h1 {
  max-width: 900px;
  margin-left: auto;
  margin-right: auto;
  font-size: clamp(38px, 6vw, 72px);
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.001em;
}
.hero-divider {
  width: 250px;
  height: 4px;
  margin: 24px 0;
  background: #2e85d8;
  border-radius: 2px;
}
.hero p {
  max-width: 550px;
  margin-bottom: 40px;
  color: rgba(255, 255, 255, 0.65);
  font-size: 15px;
  line-height: 1.8;
}
.hero-ctas {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.cta-primary {
  display: inline-flex;
  align-items: center;
  padding: 16px 48px;
  font-size: 16px;
  background: #2e85d8;
  color: #fff;
  font-weight: 600;
  border-radius: 10px;
  text-decoration: none;
  border: none;
  cursor: pointer;
}
footer {
  padding: 32px 40px;
  background: #07071a;
  border-top: 1.5px solid rgba(255, 255, 255, 0.05);
}
.footer-inner {
  max-width: 1300px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.footer-inner img {
  height: 32px;
  object-fit: contain;
  opacity: 0.65;
}
.footer-copy {
  color: rgba(255, 255, 255, 0.35);
  font-size: 13px;
  font-weight: 400;
}
@media (max-width: 768px) {
  .nav-inner {
    padding: 0 16px;
  }
  .nav-logo img {
    height: 45px;
  }
  .hero-content {
    padding: 120px 16px 48px;
  }
  footer {
    padding: 32px 16px;
  }
  .footer-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    text-align: left;
  }
  .footer-inner img {
    height: 28px;
  }
  .footer-copy {
    font-size: 12px;
    line-height: 1.5;
  }
}
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.hero-content > * {
  animation: fadeInUp 0.8s ease-out forwards;
}
.hero h1 { animation-delay: 0.2s; }
.hero-divider { animation-delay: 0.4s; }
.hero p { animation-delay: 0.6s; }
.hero-ctas { animation-delay: 0.8s; }
`;

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.textContent = styles;
    document.head.appendChild(styleTag);
    return () => styleTag.remove();
  }, []);

  return (
    <div className="lp-wrap">
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-logo">
            <img src={sbsiLogo} alt="SBSI" />
          </div>
          <div className="nav-ctas">
            <button type="button" className="btn-login" onClick={() => navigate('/customer')}>
              Log in
            </button>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-bg" style={{ backgroundImage: `url(${heroBg})` }} />
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-dot" />
            ISO 9001:2015 Certified
          </div>
          <h1>25 Years of Innovating Diagnostics Solutions</h1>
          <div className="hero-divider" />
          <p>
            A unified platform for managing contracts, expenses,
            productivity, and support — built for the business finance
            and marketing industry.
          </p>
          <div className="hero-ctas">
            <button type="button" className="cta-primary" onClick={() => navigate('/customer')}>
              Get started
            </button>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <img src={sbsiLogo} alt="SBSI Logo" />
          <span className="footer-copy">
            &copy; 2026 Scientific Biotech Specialties, Inc. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
