import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setMenuOpen(false);
    if (!isHome) {
      window.location.href = '/#' + id;
      return;
    }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="nav-container">
        <Link to="/" className="nav-logo" onClick={() => setMenuOpen(false)}>
          <span className="logo-joy">JOY</span>
          <span className="logo-sub">Joaquim Oliveira Yoga</span>
        </Link>

        <button className="nav-toggle" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <button onClick={() => scrollToSection('sobre')}>Sobre</button>
          <button onClick={() => scrollToSection('vinyasa')}>Vinyasa</button>
          <button onClick={() => scrollToSection('servicos')}>Aulas</button>
          <button onClick={() => scrollToSection('testemunhos')}>Testemunhos</button>
          <button onClick={() => scrollToSection('contacto')}>Contacto</button>
          <button
            className="nav-cta"
            onClick={() => scrollToSection('servicos')}
          >
            Reservar Aula
          </button>
        </div>
      </div>

      <style>{`
        .navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          padding: 1rem 0;
          transition: all var(--transition-normal);
          background: transparent;
        }

        .navbar.scrolled {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          box-shadow: var(--shadow-sm);
          padding: 0.75rem 0;
        }

        .nav-container {
          max-width: var(--max-width);
          margin: 0 auto;
          padding: 0 var(--spacing-page);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .nav-logo {
          display: flex;
          flex-direction: column;
          text-decoration: none;
          line-height: 1;
        }

        .logo-joy {
          font-family: var(--font-heading);
          font-size: 1.75rem;
          font-weight: 600;
          color: var(--primary-dark);
          letter-spacing: 0.1em;
        }

        .navbar:not(.scrolled) .logo-joy {
          color: white;
        }

        .logo-sub {
          font-size: 0.625rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .navbar:not(.scrolled) .logo-sub {
          color: rgba(255, 255, 255, 0.8);
        }

        .nav-toggle {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-primary);
          padding: 0.5rem;
        }

        .navbar:not(.scrolled) .nav-toggle {
          color: white;
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .nav-links button {
          background: none;
          border: none;
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary);
          padding: 0.5rem 0.75rem;
          border-radius: var(--radius-md);
          transition: all var(--transition-fast);
        }

        .navbar:not(.scrolled) .nav-links button {
          color: rgba(255, 255, 255, 0.85);
        }

        .nav-links button:hover {
          color: var(--primary);
          background: rgba(124, 154, 114, 0.08);
        }

        .navbar:not(.scrolled) .nav-links button:hover {
          color: white;
          background: rgba(255, 255, 255, 0.15);
        }

        .nav-cta {
          background: var(--primary-gradient) !important;
          color: white !important;
          padding: 0.5rem 1.25rem !important;
          border-radius: var(--radius-full) !important;
          font-weight: 500 !important;
          margin-left: 0.5rem;
        }

        .nav-cta:hover {
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
          opacity: 0.95;
          background: var(--primary-gradient) !important;
        }

        @media (max-width: 768px) {
          .nav-toggle {
            display: block;
          }

          .nav-links {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            flex-direction: column;
            padding: 1rem;
            box-shadow: var(--shadow-lg);
            gap: 0;
          }

          .nav-links.open {
            display: flex;
          }

          .nav-links button {
            color: var(--text-primary) !important;
            width: 100%;
            text-align: left;
            padding: 0.75rem 1rem;
          }

          .nav-cta {
            margin-left: 0 !important;
            margin-top: 0.5rem;
            text-align: center !important;
          }
        }
      `}</style>
    </nav>
  );
}
