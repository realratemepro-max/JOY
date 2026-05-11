import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getSiteConfig, defaultSiteConfig } from '../services/siteConfig';
import { SiteConfig } from '../types';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export function Terms() {
  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);
  useEffect(() => { getSiteConfig().then(setConfig).catch(() => {}); }, []);

  const company = config.legalCompanyName || config.siteName || 'JOY';
  const nif = config.legalNif || '[NIF]';
  const address = config.legalAddress || config.location || '[Morada]';
  const email = config.email || '[email]';
  const lastUpdate = config.legalLastUpdate || '2026-04-26';
  const cancelHours = config.cancelLimitHoursBefore ?? 2;
  const dropinDays = config.dropinValidityDays ?? 15;

  return (
    <div className="legal-page">
      <Navbar logoUrl={config.logo} siteName={config.siteName} tagline={config.tagline} />
      <main className="legal-container">
        <Link to="/" className="legal-back"><ArrowLeft size={16} /> Voltar ao site</Link>
        <h1>Termos e Condições</h1>
        <p className="legal-meta">Última atualização: {lastUpdate}</p>

        <section>
          <h2>1. Objeto</h2>
          <p>
            Estes Termos regulam o acesso e utilização do website <strong>{config.siteName}</strong>,
            incluindo a aquisição de planos e marcação de aulas. O Site é propriedade de <strong>{company}</strong>,
            NIF {nif}, com sede em {address}.
          </p>
        </section>

        <section>
          <h2>2. Aceitação</h2>
          <p>
            Ao criar uma conta ou efetuar uma compra confirmas que leste, compreendeste e aceitas estes Termos.
            Se não concordas, deves abster-te de utilizar o Site.
          </p>
        </section>

        <section>
          <h2>3. Conta de utilizador</h2>
          <ul>
            <li>Tens de ter pelo menos 18 anos para criar conta. Menores precisam de autorização do encarregado de educação.</li>
            <li>És responsável por manter a confidencialidade da tua password.</li>
            <li>Reservamos o direito de suspender contas com comportamentos abusivos ou fraudulentos.</li>
          </ul>
        </section>

        <section>
          <h2>4. Planos e aulas avulsas</h2>
          <ul>
            <li>Os planos têm validade definida (ex.: 30 dias). Após esse período, sessões não usadas expiram, exceto se estendidas por cancelamento do estúdio (ver ponto 6).</li>
            <li>Aulas avulsas têm validade de <strong>{dropinDays} dias</strong> a partir da data de compra.</li>
            <li>Não existe fidelização — não há mensalidade automática nem renovação obrigatória.</li>
          </ul>
        </section>

        <section>
          <h2>5. Pagamentos</h2>
          <p>
            Os pagamentos são processados pela <strong>EuPago</strong> via MB Way ou Multibanco.
            Aceitas que os teus dados de pagamento sejam tratados pelo provedor segundo as suas condições.
            Após confirmação do pagamento, recebes acesso imediato ao plano ou crédito de aula avulsa.
          </p>
        </section>

        <section>
          <h2>6. Cancelamento e reembolso</h2>
          <p><strong>Cancelamento de aula pelo cliente:</strong></p>
          <ul>
            <li>Até <strong>{cancelHours}h</strong> antes do início da aula → a sessão é devolvida ao plano/aula avulsa, com a validade original.</li>
            <li>Menos de {cancelHours}h antes ou no-show → a sessão é considerada utilizada e não é devolvida.</li>
          </ul>
          <p><strong>Cancelamento pelo estúdio (admin/professor):</strong></p>
          <ul>
            <li>Os alunos inscritos recebem a sessão de volta + extensão da validade do plano (ver Política de Cancelamento no perfil da conta).</li>
            <li>Se for impossível repor a sessão (plano já expirou), o crédito é convertido para vale válido pelo mesmo período.</li>
          </ul>
          <p><strong>Direito de livre resolução:</strong> conforme art. 17.º do Decreto-Lei n.º 24/2014, tens 14 dias após a compra para solicitar reembolso, exceto se já tiveres iniciado a utilização do plano (presença em aulas).</p>
        </section>

        <section>
          <h2>7. Comportamento em aula</h2>
          <ul>
            <li>Comparece com pontualidade. Atrasos superiores a 10 minutos podem implicar perda da entrada.</li>
            <li>Informa o professor de qualquer condição médica relevante antes da aula.</li>
            <li>O estúdio não é responsável por lesões resultantes do não cumprimento das indicações do professor.</li>
            <li>Reservamos o direito de recusar entrada por questões de segurança ou comportamento inadequado.</li>
          </ul>
        </section>

        <section>
          <h2>8. Códigos promo e vales oferta</h2>
          <ul>
            <li>Os códigos promocionais são pessoais, intransmissíveis e válidos até à data de expiração indicada.</li>
            <li>Vales oferta podem ser usados parcialmente; o saldo restante mantém-se até à expiração.</li>
            <li>Não acumulam com outros descontos salvo indicação contrária.</li>
          </ul>
        </section>

        <section>
          <h2>9. Propriedade intelectual</h2>
          <p>
            Todos os conteúdos do Site (textos, imagens, logos, vídeos da biblioteca) são propriedade do estúdio
            ou utilizados com licença. Está vedada a reprodução ou distribuição sem autorização escrita.
          </p>
        </section>

        <section>
          <h2>10. Limitação de responsabilidade</h2>
          <p>
            O estúdio fará os melhores esforços para garantir o funcionamento do Site, mas não pode garantir
            disponibilidade ininterrupta. Não somos responsáveis por danos indiretos resultantes da utilização
            ou indisponibilidade do serviço.
          </p>
        </section>

        <section>
          <h2>11. Lei aplicável e foro</h2>
          <p>
            Estes Termos regem-se pela lei portuguesa. Para resolução de litígios, é competente o foro do tribunal
            da comarca da sede do estúdio, com expressa renúncia a qualquer outro.
          </p>
        </section>

        <section>
          <h2>12. Contacto</h2>
          <p>
            Para dúvidas sobre estes Termos: <a href={`mailto:${email}`}>{email}</a>.
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
