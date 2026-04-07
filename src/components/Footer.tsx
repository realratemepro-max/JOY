import React from 'react';
import { Instagram, Facebook, Youtube, Mail, Phone, MapPin } from 'lucide-react';
import { SiteConfig } from '../types';

interface FooterProps {
  config: SiteConfig;
}

export function Footer({ config }: FooterProps) {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="footer-logo">
              <span className="logo-joy">JOY</span>
              <span className="logo-sub">Joaquim Oliveira Yoga</span>
            </div>
            <p className="footer-tagline">{config.tagline}</p>
          </div>

          <div className="footer-contact">
            <h4>Contacto</h4>
            <div className="contact-items">
              {config.email && (
                <a href={`mailto:${config.email}`}>
                  <Mail size={16} />
                  {config.email}
                </a>
              )}
              {config.phone && (
                <a href={`tel:${config.phone}`}>
                  <Phone size={16} />
                  {config.phone}
                </a>
              )}
              {config.location && (
                <span>
                  <MapPin size={16} />
                  {config.location}
                </span>
              )}
            </div>
          </div>

          <div className="footer-social">
            <h4>Redes Sociais</h4>
            <div className="social-links">
              {config.instagram && (
                <a href={`https://instagram.com/${config.instagram}`} target="_blank" rel="noopener noreferrer">
                  <Instagram size={20} />
                </a>
              )}
              {config.facebook && (
                <a href={`https://facebook.com/${config.facebook}`} target="_blank" rel="noopener noreferrer">
                  <Facebook size={20} />
                </a>
              )}
              {config.youtube && (
                <a href={`https://youtube.com/${config.youtube}`} target="_blank" rel="noopener noreferrer">
                  <Youtube size={20} />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>{config.footerText}</p>
        </div>
      </div>

      <style>{`
        .footer {
          background: var(--gray-900);
          color: rgba(255, 255, 255, 0.8);
          padding: 4rem 0 0;
        }

        .footer-container {
          max-width: var(--max-width);
          margin: 0 auto;
          padding: 0 var(--spacing-page);
        }

        .footer-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr;
          gap: 3rem;
          padding-bottom: 3rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .footer-logo {
          display: flex;
          flex-direction: column;
          line-height: 1;
          margin-bottom: 1rem;
        }

        .footer-logo .logo-joy {
          font-family: var(--font-heading);
          font-size: 2rem;
          font-weight: 600;
          color: var(--primary-light);
          letter-spacing: 0.1em;
        }

        .footer-logo .logo-sub {
          font-size: 0.625rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 4px;
        }

        .footer-tagline {
          font-size: 0.9375rem;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.6);
        }

        .footer-contact h4,
        .footer-social h4 {
          font-family: var(--font-body);
          font-size: 0.875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 1.25rem;
        }

        .contact-items {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .contact-items a,
        .contact-items span {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9375rem;
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;
          transition: color var(--transition-fast);
        }

        .contact-items a:hover {
          color: var(--primary-light);
        }

        .social-links {
          display: flex;
          gap: 1rem;
        }

        .social-links a {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-full);
          border: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.7);
          transition: all var(--transition-fast);
        }

        .social-links a:hover {
          background: var(--primary);
          border-color: var(--primary);
          color: white;
        }

        .footer-bottom {
          padding: 1.5rem 0;
          text-align: center;
        }

        .footer-bottom p {
          font-size: 0.8125rem;
          color: rgba(255, 255, 255, 0.4);
          margin: 0;
        }

        @media (max-width: 768px) {
          .footer-grid {
            grid-template-columns: 1fr;
            gap: 2rem;
          }
        }
      `}</style>
    </footer>
  );
}
