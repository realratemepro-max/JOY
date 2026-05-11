import React, { useEffect, useRef, useState } from 'react';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { Loader, LogOut, Check } from 'lucide-react';

const TERMS_VERSION = '2026-04-26';

interface ConsentGateProps {
  children: React.ReactNode;
}

/**
 * Blocks access to authenticated client area until the user accepts the latest
 * Terms & Privacy. Existing users without `termsAcceptedAt` see this on next login.
 *
 * Behavior:
 * - Loads the user doc to check `termsAcceptedAt` and `termsAcceptedVersion`
 * - If the field is missing OR the version differs from current → modal blocks
 * - User must scroll through both documents AND tick checkbox before "Aceitar" enables
 * - "Sair" logs out
 */
export function ConsentGate({ children }: ConsentGateProps) {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [scrolledTerms, setScrolledTerms] = useState(false);
  const [scrolledPrivacy, setScrolledPrivacy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const termsRef = useRef<HTMLDivElement>(null);
  const privacyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) { setLoading(false); setNeedsConsent(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (cancelled) return;
        if (!snap.exists()) { setNeedsConsent(false); return; }
        const data = snap.data();
        const accepted = data.termsAcceptedAt && data.termsAcceptedVersion === TERMS_VERSION;
        setNeedsConsent(!accepted);
      } catch (e) { console.error('ConsentGate load failed', e); setNeedsConsent(false); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const onScroll = (which: 'terms' | 'privacy') => (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const reachedBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    if (!reachedBottom) return;
    if (which === 'terms') setScrolledTerms(true);
    else setScrolledPrivacy(true);
  };

  const handleAccept = async () => {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        termsAcceptedAt: Timestamp.now(),
        termsAcceptedVersion: TERMS_VERSION,
      });
      setNeedsConsent(false);
    } catch (e: any) {
      setError(e?.message || 'Não foi possível guardar o consentimento.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefuse = async () => {
    try { await logout(); } catch {}
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} /></div>;
  }

  if (!needsConsent) return <>{children}</>;

  const canAccept = scrolledTerms && scrolledPrivacy && accepted;

  return (
    <div className="consent-gate-overlay" role="dialog" aria-modal="true" aria-label="Consentimento de Termos e Privacidade">
      <div className="consent-gate-card">
        <div className="consent-header">
          <h2>Atualizamos os nossos Termos e Privacidade</h2>
          <p>Para continuar a usar a tua conta precisamos do teu consentimento. Lê os dois documentos abaixo (faz scroll até ao fim de cada) e confirma com a checkbox.</p>
        </div>

        <div className="consent-docs">
          <div className="consent-doc">
            <div className="consent-doc-head">
              <strong>1. Termos e Condições</strong>
              {scrolledTerms && <span className="consent-doc-done"><Check size={14} /> Lido</span>}
            </div>
            <div ref={termsRef} className="consent-doc-body" onScroll={onScroll('terms')}>
              <TermsContent />
            </div>
          </div>

          <div className="consent-doc">
            <div className="consent-doc-head">
              <strong>2. Política de Privacidade</strong>
              {scrolledPrivacy && <span className="consent-doc-done"><Check size={14} /> Lido</span>}
            </div>
            <div ref={privacyRef} className="consent-doc-body" onScroll={onScroll('privacy')}>
              <PrivacyContent />
            </div>
          </div>
        </div>

        <label className="consent-checkbox">
          <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} disabled={!scrolledTerms || !scrolledPrivacy} />
          <span>
            Li e aceito os Termos e Condições e a Política de Privacidade.
            {(!scrolledTerms || !scrolledPrivacy) && <em style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Faz scroll até ao fim de ambos os documentos para ativar.</em>}
          </span>
        </label>

        {error && <div className="consent-error">{error}</div>}

        <div className="consent-actions">
          <button className="btn btn-secondary" onClick={handleRefuse} disabled={submitting}>
            <LogOut size={16} /> Não aceito (sair)
          </button>
          <button className="btn btn-primary" onClick={handleAccept} disabled={!canAccept || submitting}>
            {submitting ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Aceitar e continuar'}
          </button>
        </div>
      </div>

      <style>{`
        .consent-gate-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .consent-gate-card { background: white; border-radius: var(--radius-xl); width: 100%; max-width: 720px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.25); overflow: hidden; }
        .consent-header { padding: 1.5rem 1.5rem 0.875rem; border-bottom: 1px solid var(--beige); }
        .consent-header h2 { margin: 0 0 0.5rem; font-family: var(--font-body); font-size: 1.25rem; }
        .consent-header p { margin: 0; font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5; }
        .consent-docs { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem 1.5rem; flex: 1; min-height: 0; overflow: hidden; }
        .consent-doc { display: flex; flex-direction: column; min-height: 0; flex: 1; border: 1px solid var(--sand); border-radius: var(--radius-lg); overflow: hidden; }
        .consent-doc-head { display: flex; justify-content: space-between; align-items: center; padding: 0.625rem 0.875rem; background: var(--bg-secondary); font-size: 0.875rem; }
        .consent-doc-done { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: #166534; background: #d1fae5; padding: 0.15rem 0.5rem; border-radius: 999px; font-weight: 600; }
        .consent-doc-body { padding: 0.875rem 1rem; overflow-y: auto; font-size: 0.875rem; line-height: 1.5; color: var(--text-secondary); flex: 1; min-height: 120px; }
        .consent-doc-body h3 { margin: 0.875rem 0 0.5rem; color: var(--text-primary); font-size: 0.9375rem; }
        .consent-doc-body h3:first-child { margin-top: 0; }
        .consent-doc-body p, .consent-doc-body li { font-size: 0.8125rem; line-height: 1.55; }
        .consent-doc-body ul { padding-left: 1.25rem; margin: 0.375rem 0 0.625rem; }
        .consent-checkbox { display: flex; align-items: flex-start; gap: 0.625rem; padding: 0.875rem 1.5rem; border-top: 1px solid var(--beige); cursor: pointer; }
        .consent-checkbox input[type=checkbox] { margin-top: 3px; flex-shrink: 0; width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary); }
        .consent-checkbox input[type=checkbox]:disabled { cursor: not-allowed; }
        .consent-checkbox span { font-size: 0.875rem; color: var(--text-primary); }
        .consent-actions { display: flex; justify-content: space-between; gap: 0.625rem; padding: 0.875rem 1.5rem 1.25rem; border-top: 1px solid var(--beige); flex-wrap: wrap; }
        .consent-actions .btn { gap: 0.4rem; }
        .consent-error { padding: 0.625rem 1.5rem; color: #991b1b; background: #fef2f2; font-size: 0.8125rem; }
        @media (max-width: 640px) {
          .consent-gate-card { max-height: 96vh; }
          .consent-doc-body { min-height: 90px; }
          .consent-actions { flex-direction: column-reverse; }
          .consent-actions .btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  );
}

function TermsContent() {
  return (
    <>
      <h3>1. Objeto</h3>
      <p>Estes Termos regulam o acesso e utilização do website JOY, incluindo a aquisição de planos e marcação de aulas.</p>
      <h3>2. Aceitação</h3>
      <p>Ao criar uma conta ou efetuar uma compra confirmas que leste, compreendeste e aceitas estes Termos.</p>
      <h3>3. Conta de utilizador</h3>
      <ul>
        <li>Tens de ter pelo menos 18 anos para criar conta.</li>
        <li>És responsável pela confidencialidade da tua password.</li>
        <li>Reservamos o direito de suspender contas com comportamentos abusivos.</li>
      </ul>
      <h3>4. Planos e aulas avulsas</h3>
      <ul>
        <li>Os planos têm validade definida (ex.: 30 dias). Sessões não usadas expiram, exceto se estendidas por cancelamento do estúdio.</li>
        <li>Aulas avulsas têm validade desde a data de compra (ver detalhes na página /termos).</li>
        <li>Não existe fidelização — sem mensalidade automática nem renovação obrigatória.</li>
      </ul>
      <h3>5. Pagamentos</h3>
      <p>Os pagamentos são processados pela EuPago via MB Way ou Multibanco. Não armazenamos dados de cartão.</p>
      <h3>6. Cancelamento e reembolso</h3>
      <p>Aulas canceladas dentro do prazo voltam ao plano com a validade original. Cancelamentos pelo estúdio devolvem a sessão e estendem a validade.</p>
      <h3>7. Comportamento em aula</h3>
      <ul>
        <li>Comparece com pontualidade.</li>
        <li>Informa o professor de qualquer condição médica relevante.</li>
        <li>O estúdio não é responsável por lesões resultantes do não cumprimento das indicações.</li>
      </ul>
      <h3>8. Códigos promo e vales oferta</h3>
      <p>Códigos são pessoais, intransmissíveis e válidos até à expiração indicada. Vales podem ser usados parcialmente.</p>
      <h3>9. Propriedade intelectual</h3>
      <p>Todos os conteúdos do Site são propriedade do estúdio ou utilizados com licença. Reprodução não autorizada é vedada.</p>
      <h3>10. Limitação de responsabilidade</h3>
      <p>Faremos os melhores esforços para garantir o funcionamento do Site, mas não podemos garantir disponibilidade ininterrupta.</p>
      <h3>11. Lei aplicável</h3>
      <p>Estes Termos regem-se pela lei portuguesa. Para resolução de litígios, é competente o foro do tribunal da comarca da sede do estúdio.</p>
      <h3>12. Contacto</h3>
      <p>Para dúvidas, contacta a equipa por email.</p>
      <p style={{ marginTop: '0.875rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Versão completa em <a href="/termos" target="_blank" rel="noopener noreferrer">/termos</a>.
      </p>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <h3>1. Quem somos</h3>
      <p>Esta Política aplica-se ao website JOY, propriedade do estúdio.</p>
      <h3>2. Dados que recolhemos</h3>
      <ul>
        <li>Dados de conta: nome, email, telefone, data de nascimento (opcional).</li>
        <li>Dados de pagamento: processados pela EuPago — não armazenamos dados de cartão.</li>
        <li>Dados de utilização: aulas marcadas, presenças, classificações, mensagens.</li>
        <li>Cookies técnicos: sessão de autenticação e preferências.</li>
      </ul>
      <h3>3. Como usamos os teus dados</h3>
      <ul>
        <li>Gerir conta e marcações.</li>
        <li>Processar pagamentos e emitir recibos.</li>
        <li>Enviar notificações de aulas e expiração de plano.</li>
        <li>Cumprir obrigações legais e fiscais.</li>
      </ul>
      <h3>4. Base legal</h3>
      <p>Tratamos os teus dados com base na execução do contrato, no consentimento e no cumprimento de obrigações legais.</p>
      <h3>5. Partilha com terceiros</h3>
      <ul>
        <li>EuPago — pagamentos.</li>
        <li>Google Firebase — alojamento, autenticação e base de dados (UE).</li>
        <li>Provedor de email — envio de notificações.</li>
        <li>Autoridades — apenas se legalmente exigido.</li>
      </ul>
      <p>Não vendemos nem cedemos os teus dados para fins comerciais.</p>
      <h3>6. Conservação</h3>
      <p>Mantemos os teus dados enquanto a conta estiver ativa e até 5 anos após a última atividade (obrigações fiscais).</p>
      <h3>7. Os teus direitos (RGPD)</h3>
      <ul>
        <li>Aceder, corrigir, eliminar os teus dados.</li>
        <li>Portabilidade — receber os teus dados em formato legível.</li>
        <li>Oposição ao tratamento para fins de marketing.</li>
        <li>Apresentar queixa à CNPD.</li>
      </ul>
      <h3>8. Cookies</h3>
      <p>Usamos cookies técnicos essenciais (autenticação) que não requerem consentimento. Não usamos cookies de marketing.</p>
      <h3>9. Segurança</h3>
      <p>Os dados são protegidos com encriptação TLS, regras de acesso Firestore e autenticação Firebase.</p>
      <h3>10. Alterações</h3>
      <p>Reservamo-nos o direito de atualizar esta política. As alterações entram em vigor após publicação no Site.</p>
      <p style={{ marginTop: '0.875rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Versão completa em <a href="/privacidade" target="_blank" rel="noopener noreferrer">/privacidade</a>.
      </p>
    </>
  );
}
