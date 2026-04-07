import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getSiteConfig, defaultSiteConfig } from '../services/siteConfig';
import { SiteConfig, YogaService, Testimonial } from '../types';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Heart, Wind, Brain, Moon, Shield, Eye, Sparkles, Activity,
  Star, ChevronRight, Phone, Mail, MapPin, Instagram, ArrowDown,
  Check
} from 'lucide-react';

export function LandingPage() {
  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [services, setServices] = useState<YogaService[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [siteConfig, servicesSnap, testimonialsSnap] = await Promise.all([
        getSiteConfig(),
        getDocs(query(collection(db, 'services'), where('isActive', '==', true), orderBy('order'))),
        getDocs(query(collection(db, 'testimonials'), where('isActive', '==', true), orderBy('order'))),
      ]);

      setConfig(siteConfig);

      setServices(servicesSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate(),
        updatedAt: d.data().updatedAt?.toDate(),
      } as YogaService)));

      setTestimonials(testimonialsSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate(),
      } as Testimonial)));
    } catch (err) {
      console.error('Error loading landing data:', err);
    } finally {
      setLoading(false);
    }
  };

  const benefitIcons = [Heart, Wind, Brain, Moon, Shield, Eye, Sparkles, Activity];

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="landing-page">
      <Navbar />

      {/* HERO SECTION */}
      <section className="hero">
        <div className="hero-overlay" />
        <div className="hero-content animate-slideUp">
          <span className="hero-badge">Vinyasa Yoga</span>
          <h1>{config.heroTitle}</h1>
          <p className="hero-subtitle">{config.heroSubtitle}</p>
          <div className="hero-buttons">
            <a href={config.heroCtaLink} className="btn btn-primary btn-lg">
              {config.heroCtaText}
              <ChevronRight size={20} />
            </a>
            <a href="#sobre" className="btn btn-hero-secondary btn-lg">
              Saber Mais
            </a>
          </div>
          <a href="#sobre" className="scroll-indicator">
            <ArrowDown size={20} />
          </a>
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section id="sobre" className="section about-section">
        <div className="container">
          <div className="about-grid">
            <div className="about-image-col">
              <div className="about-image-wrapper">
                {config.aboutImage ? (
                  <img src={config.aboutImage} alt="Joaquim Oliveira" />
                ) : (
                  <div className="about-image-placeholder">
                    <span>JO</span>
                  </div>
                )}
              </div>
              <div className="about-highlights">
                {config.aboutHighlights.map((h, i) => (
                  <div key={i} className="highlight-item">
                    <Check size={16} />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="about-text-col">
              <span className="section-label">Sobre Mim</span>
              <h2>{config.aboutTitle}</h2>
              <div className="divider divider-left" />
              {config.aboutText.split('\n\n').map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* VINYASA SECTION */}
      <section id="vinyasa" className="section vinyasa-section">
        <div className="container">
          <span className="section-label text-center">A Prática</span>
          <h2 className="section-title">{config.vinyasaTitle}</h2>
          <div className="divider" />
          <p className="section-subtitle">{config.vinyasaText}</p>

          <div className="benefits-grid">
            {config.vinyasaBenefits.map((benefit, i) => {
              const Icon = benefitIcons[i % benefitIcons.length];
              return (
                <div key={i} className="benefit-card">
                  <div className="benefit-icon">
                    <Icon size={24} />
                  </div>
                  <p>{benefit}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SERVICES SECTION */}
      <section id="servicos" className="section services-section">
        <div className="container">
          <span className="section-label text-center">Aulas Particulares</span>
          <h2 className="section-title">Escolhe o Teu Plano</h2>
          <div className="divider" />
          <p className="section-subtitle">
            Cada aula é totalmente personalizada e adaptada ao teu nível, objetivos e necessidades.
          </p>

          {services.length > 0 ? (
            <div className="services-grid">
              {services.map(service => (
                <div key={service.id} className={`service-card ${service.isPopular ? 'popular' : ''}`}>
                  {service.isPopular && <span className="popular-badge">Mais Popular</span>}
                  <h3>{service.name}</h3>
                  <p className="service-desc">{service.description}</p>
                  <div className="service-price">
                    <span className="price-amount">{service.price.toFixed(2).replace('.', ',')}€</span>
                    <span className="price-detail">{service.duration}</span>
                  </div>
                  <ul className="service-features">
                    {service.features.map((f, i) => (
                      <li key={i}><Check size={16} /> {f}</li>
                    ))}
                  </ul>
                  <Link
                    to={`/checkout?plan=${service.id}`}
                    className={`btn ${service.isPopular ? 'btn-primary' : 'btn-outline'} w-full`}
                  >
                    Reservar Agora
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-services">
              <p>Os serviços estarão disponíveis em breve.</p>
            </div>
          )}
        </div>
      </section>

      {/* TESTIMONIALS SECTION */}
      {testimonials.length > 0 && (
        <section id="testemunhos" className="section testimonials-section">
          <div className="container">
            <span className="section-label text-center">Testemunhos</span>
            <h2 className="section-title">O que dizem os meus alunos</h2>
            <div className="divider" />

            <div className="testimonials-grid">
              {testimonials.map(t => (
                <div key={t.id} className="testimonial-card">
                  <div className="testimonial-stars">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={16} fill={i < t.rating ? '#f59e0b' : 'none'} color={i < t.rating ? '#f59e0b' : '#d1d5db'} />
                    ))}
                  </div>
                  <p className="testimonial-text">"{t.text}"</p>
                  <div className="testimonial-author">
                    {t.photo ? (
                      <img src={t.photo} alt={t.name} className="testimonial-avatar" />
                    ) : (
                      <div className="testimonial-avatar-placeholder">
                        {t.name.charAt(0)}
                      </div>
                    )}
                    <span className="testimonial-name">{t.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CONTACT / CTA SECTION */}
      <section id="contacto" className="section contact-section">
        <div className="container">
          <div className="contact-grid">
            <div className="contact-info">
              <span className="section-label">Contacto</span>
              <h2>Pronto para começar?</h2>
              <div className="divider divider-left" />
              <p>
                Marca a tua primeira aula experimental e descobre como o Vinyasa Yoga
                pode transformar a tua vida. Não é preciso experiência prévia.
              </p>
              <div className="contact-details">
                {config.phone && (
                  <a href={`tel:${config.phone}`} className="contact-item">
                    <Phone size={20} />
                    <span>{config.phone}</span>
                  </a>
                )}
                {config.email && (
                  <a href={`mailto:${config.email}`} className="contact-item">
                    <Mail size={20} />
                    <span>{config.email}</span>
                  </a>
                )}
                {config.location && (
                  <div className="contact-item">
                    <MapPin size={20} />
                    <span>{config.location}</span>
                  </div>
                )}
                {config.instagram && (
                  <a href={`https://instagram.com/${config.instagram}`} target="_blank" rel="noopener noreferrer" className="contact-item">
                    <Instagram size={20} />
                    <span>@{config.instagram}</span>
                  </a>
                )}
              </div>
            </div>
            <div className="contact-cta-card">
              <h3>Aula Experimental</h3>
              <p>Agenda a tua primeira sessão e sente a diferença do acompanhamento personalizado.</p>
              <a href={`mailto:${config.email}?subject=Aula Experimental de Yoga`} className="btn btn-primary btn-lg w-full">
                Enviar Email
              </a>
              {config.phone && (
                <a href={`tel:${config.phone}`} className="btn btn-outline btn-lg w-full">
                  Ligar Agora
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer config={config} />

      <style>{`
        .landing-page {
          background: var(--bg-primary);
        }

        /* HERO */
        .hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: url('https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1920&q=80') center/cover no-repeat;
          color: white;
          text-align: center;
          overflow: hidden;
        }

        .hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(26, 26, 46, 0.65) 0%, rgba(45, 52, 54, 0.75) 100%);
        }

        .hero-content {
          position: relative;
          z-index: 1;
          max-width: 750px;
          padding: 2rem var(--spacing-page);
        }

        .hero-badge {
          display: inline-block;
          padding: 0.375rem 1.25rem;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: var(--radius-full);
          font-size: 0.8125rem;
          font-weight: 500;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin-bottom: 1.5rem;
        }

        .hero h1 {
          font-size: 3.75rem;
          font-weight: 300;
          line-height: 1.15;
          color: white;
          margin-bottom: 1.5rem;
        }

        .hero-subtitle {
          font-size: 1.125rem;
          line-height: 1.7;
          color: rgba(255, 255, 255, 0.85);
          margin-bottom: 2.5rem;
        }

        .hero-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn-hero-secondary {
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
        }

        .btn-hero-secondary:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .scroll-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          margin: 3rem auto 0;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          color: rgba(255, 255, 255, 0.6);
          animation: breathe 3s ease infinite;
        }

        /* SECTION LABEL */
        .section-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: var(--primary);
          margin-bottom: 0.75rem;
        }

        .section-label.text-center {
          text-align: center;
        }

        .divider-left {
          margin-left: 0;
          margin-right: auto;
        }

        /* ABOUT */
        .about-section {
          background: var(--bg-secondary);
        }

        .about-grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 4rem;
          align-items: center;
        }

        .about-image-wrapper {
          border-radius: var(--radius-2xl);
          overflow: hidden;
          box-shadow: var(--shadow-xl);
          aspect-ratio: 4/5;
        }

        .about-image-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .about-image-placeholder {
          width: 100%;
          height: 100%;
          background: var(--primary-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-heading);
          font-size: 5rem;
          font-weight: 300;
          color: white;
        }

        .about-highlights {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-top: 1.5rem;
        }

        .highlight-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--primary-dark);
          background: white;
          padding: 0.625rem 0.875rem;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }

        .highlight-item svg {
          color: var(--primary);
          flex-shrink: 0;
        }

        .about-text-col h2 {
          margin-bottom: 0;
        }

        .about-text-col p {
          color: var(--text-secondary);
          font-size: 1.0625rem;
          line-height: 1.8;
        }

        /* VINYASA */
        .vinyasa-section {
          background: var(--bg-primary);
        }

        .benefits-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
          margin-top: 1rem;
        }

        .benefit-card {
          background: var(--bg-secondary);
          border-radius: var(--radius-xl);
          padding: 1.75rem;
          text-align: center;
          transition: all var(--transition-normal);
        }

        .benefit-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }

        .benefit-icon {
          width: 52px;
          height: 52px;
          background: var(--primary-gradient);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          margin: 0 auto 1rem;
        }

        .benefit-card p {
          font-size: 0.9375rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        /* SERVICES */
        .services-section {
          background: var(--bg-secondary);
        }

        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          max-width: 1000px;
          margin: 0 auto;
        }

        .service-card {
          background: white;
          border-radius: var(--radius-xl);
          padding: 2rem;
          text-align: center;
          position: relative;
          border: 2px solid transparent;
          transition: all var(--transition-normal);
          display: flex;
          flex-direction: column;
        }

        .service-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-xl);
        }

        .service-card.popular {
          border-color: var(--primary);
          box-shadow: var(--shadow-lg);
        }

        .popular-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--primary-gradient);
          color: white;
          padding: 0.25rem 1rem;
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          font-weight: 600;
          white-space: nowrap;
        }

        .service-card h3 {
          font-size: 1.375rem;
          margin-bottom: 0.5rem;
        }

        .service-desc {
          font-size: 0.9375rem;
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
        }

        .service-price {
          margin-bottom: 1.5rem;
        }

        .price-amount {
          font-family: var(--font-heading);
          font-size: 2.75rem;
          font-weight: 600;
          color: var(--text-heading);
        }

        .price-detail {
          display: block;
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-top: 0.25rem;
        }

        .service-features {
          list-style: none;
          padding: 0;
          margin: 0 0 2rem 0;
          text-align: left;
          flex: 1;
        }

        .service-features li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.5rem 0;
          font-size: 0.9375rem;
          color: var(--text-secondary);
        }

        .service-features li svg {
          color: var(--primary);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .no-services {
          text-align: center;
          padding: 3rem;
          color: var(--text-secondary);
        }

        /* TESTIMONIALS */
        .testimonials-section {
          background: var(--bg-primary);
        }

        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-top: 1rem;
        }

        .testimonial-card {
          background: var(--bg-secondary);
          border-radius: var(--radius-xl);
          padding: 2rem;
        }

        .testimonial-stars {
          display: flex;
          gap: 0.125rem;
          margin-bottom: 1rem;
        }

        .testimonial-text {
          font-size: 1rem;
          font-style: italic;
          color: var(--text-secondary);
          line-height: 1.7;
          margin-bottom: 1.5rem;
        }

        .testimonial-author {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .testimonial-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
        }

        .testimonial-avatar-placeholder {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--primary-gradient);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .testimonial-name {
          font-weight: 600;
          font-size: 0.9375rem;
        }

        /* CONTACT */
        .contact-section {
          background: var(--bg-secondary);
        }

        .contact-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 4rem;
          align-items: start;
        }

        .contact-info h2 {
          margin-bottom: 0;
        }

        .contact-info p {
          color: var(--text-secondary);
          font-size: 1.0625rem;
          line-height: 1.8;
        }

        .contact-details {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 1rem;
        }

        .contact-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 1rem;
          color: var(--text-primary);
          text-decoration: none;
          transition: color var(--transition-fast);
        }

        .contact-item:hover {
          color: var(--primary);
        }

        .contact-item svg {
          color: var(--primary);
          flex-shrink: 0;
        }

        .contact-cta-card {
          background: white;
          border-radius: var(--radius-xl);
          padding: 2.5rem;
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .contact-cta-card h3 {
          font-size: 1.5rem;
          text-align: center;
        }

        .contact-cta-card p {
          text-align: center;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }

        /* RESPONSIVE */
        @media (max-width: 1024px) {
          .benefits-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .hero h1 {
            font-size: 2.25rem;
          }

          .hero-subtitle {
            font-size: 1rem;
          }

          .hero-buttons {
            flex-direction: column;
            align-items: center;
          }

          .about-grid {
            grid-template-columns: 1fr;
            gap: 2rem;
          }

          .about-image-wrapper {
            max-width: 400px;
            margin: 0 auto;
          }

          .about-highlights {
            grid-template-columns: 1fr;
          }

          .benefits-grid {
            grid-template-columns: 1fr;
          }

          .services-grid {
            grid-template-columns: 1fr;
          }

          .testimonials-grid {
            grid-template-columns: 1fr;
          }

          .contact-grid {
            grid-template-columns: 1fr;
            gap: 2rem;
          }
        }
      `}</style>
    </div>
  );
}
