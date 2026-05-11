import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getSiteConfig, defaultSiteConfig } from '../services/siteConfig';
import { SiteConfig } from '../types';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export function Privacy() {
  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);
  useEffect(() => { getSiteConfig().then(setConfig).catch(() => {}); }, []);

  const company = config.legalCompanyName || config.siteName || 'JOY';
  const nif = config.legalNif || '[NIF]';
  const address = config.legalAddress || config.location || '[Morada]';
  const email = config.email || '[email]';
  const lastUpdate = config.legalLastUpdate || '2026-04-26';

  return (
    <div className="legal-page">
      <Navbar logoUrl={config.logo} siteName={config.siteName} tagline={config.tagline} />
      <main className="legal-container">
        <Link to="/" className="legal-back"><ArrowLeft size={16} /> Voltar ao site</Link>
        <h1>Política de Privacidade</h1>
        <p className="legal-meta">Última atualização: {lastUpdate}</p>

        <section>
          <h2>1. Quem somos</h2>
          <p>
            Esta Política de Privacidade aplica-se ao website <strong>{config.siteName}</strong> (o "Site"),
            propriedade de <strong>{company}</strong>, NIF {nif}, com sede em {address}.
            Para questões relacionadas com privacidade, contacta-nos em <a href={`mailto:${email}`}>{email}</a>.
          </p>
        </section>

        <section>
          <h2>2. Dados que recolhemos</h2>
          <p>Recolhemos os seguintes dados pessoais quando interages com o Site:</p>
          <ul>
            <li><strong>Dados de conta:</strong> nome, email, telefone, data de nascimento (opcional).</li>
            <li><strong>Dados de pagamento:</strong> processados pelo nosso parceiro EuPago — não armazenamos dados de cartão.</li>
            <li><strong>Dados de utilização:</strong> aulas marcadas, presenças, classificações, mensagens trocadas com a equipa.</li>
            <li><strong>Cookies técnicos:</strong> sessão de autenticação e preferências de utilização.</li>
          </ul>
        </section>

        <section>
          <h2>3. Como usamos os teus dados</h2>
          <ul>
            <li>Gerir a tua conta e marcações de aulas.</li>
            <li>Processar pagamentos (via EuPago) e emitir recibos.</li>
            <li>Enviar notificações de aulas, alterações ou expiração de plano.</li>
            <li>Cumprir obrigações legais e fiscais.</li>
            <li>Melhorar o serviço (estatísticas anonimizadas).</li>
          </ul>
        </section>

        <section>
          <h2>4. Base legal</h2>
          <p>
            Tratamos os teus dados com base na execução do contrato (prestação do serviço de aulas),
            no consentimento (newsletter e comunicações de marketing) e no cumprimento de obrigações legais
            (faturação e contabilidade).
          </p>
        </section>

        <section>
          <h2>5. Partilha com terceiros</h2>
          <p>Partilhamos dados estritamente necessários com:</p>
          <ul>
            <li><strong>EuPago</strong> — processamento de pagamentos.</li>
            <li><strong>Google Firebase</strong> — alojamento, autenticação e base de dados (servidores na UE).</li>
            <li><strong>Provedor de email</strong> (Gmail / Resend) — envio de notificações.</li>
            <li><strong>Autoridades</strong> — apenas se legalmente exigido.</li>
          </ul>
          <p>Não vendemos nem cedemos os teus dados para fins comerciais.</p>
        </section>

        <section>
          <h2>6. Conservação dos dados</h2>
          <p>
            Mantemos os teus dados enquanto a tua conta estiver ativa e até 5 anos após a última atividade,
            para cumprimento de obrigações fiscais (artigo 123.º do CIRC). Podes pedir a eliminação antecipada
            dos dados não exigidos por lei.
          </p>
        </section>

        <section>
          <h2>7. Os teus direitos (RGPD)</h2>
          <p>Tens direito a:</p>
          <ul>
            <li>Aceder aos teus dados pessoais.</li>
            <li>Corrigir dados incorretos.</li>
            <li>Eliminar a tua conta e dados associados.</li>
            <li>Portabilidade — receberes os teus dados em formato legível.</li>
            <li>Oposição ao tratamento para fins de marketing.</li>
            <li>Apresentar queixa à <a href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer">CNPD</a>.</li>
          </ul>
          <p>Para exerceres qualquer destes direitos, contacta-nos em <a href={`mailto:${email}`}>{email}</a>.</p>
        </section>

        <section>
          <h2>8. Cookies</h2>
          <p>
            Usamos cookies técnicos essenciais (autenticação) que não requerem consentimento.
            Não usamos cookies de marketing ou rastreamento sem o teu consentimento.
          </p>
        </section>

        <section>
          <h2>9. Segurança</h2>
          <p>
            Os teus dados são protegidos com encriptação TLS, regras de acesso Firestore e autenticação Firebase.
            Em caso de violação que afete os teus direitos, seremos transparentes contigo dentro de 72h.
          </p>
        </section>

        <section>
          <h2>10. Alterações a esta política</h2>
          <p>
            Reservamo-nos o direito de atualizar esta política. As alterações entram em vigor após publicação no Site.
            Se forem materialmente significativas, notificaremos por email.
          </p>
        </section>
      </main>
      <Footer config={config} />

      <style>{`
        .legal-page { background: var(--bg-primary); min-height: 100vh; }
        .legal-container { max-width: 760px; margin: 0 auto; padding: 7rem 1.5rem 4rem; }
        .legal-back { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); text-decoration: none; margin-bottom: 1.5rem; font-size: 0.9rem; }
        .legal-back:hover { color: var(--primary); }
        .legal-page h1 { font-size: 2.25rem; margin-bottom: 0.5rem; }
        .legal-meta { font-size: 0.875rem; color: var(--text-muted); margin-bottom: 2.5rem; }
        .legal-container section { margin-bottom: 2rem; }
        .legal-container h2 { font-size: 1.25rem; font-family: var(--font-body); font-weight: 600; margin: 0 0 0.75rem; color: var(--text-primary); }
        .legal-container p, .legal-container li { font-size: 1rem; line-height: 1.7; color: var(--text-secondary); }
        .legal-container ul { padding-left: 1.5rem; margin: 0.75rem 0; }
        .legal-container li { margin-bottom: 0.5rem; }
        .legal-container a { color: var(--primary); text-decoration: underline; }
      `}</style>
    </div>
  );
}
