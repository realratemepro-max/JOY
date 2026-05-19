import React, { useEffect, useState } from 'react';
import { Download, X, Share, Plus, Smartphone } from 'lucide-react';
import { useInstallPrompt } from '../services/installPwa';

const STORAGE_KEY_DISMISSED = 'joy_install_prompt_dismissed_v1';
const DISMISS_TTL_DAYS = 14;

/**
 * Auto-shown banner promoting PWA install.
 * - Android / Chrome desktop: shows when browser fires beforeinstallprompt.
 * - iOS Safari: shows after 5s (we can't programmatically install, but the modal explains how).
 * - Dismissible for 14 days. Hidden if already installed.
 */
export function InstallAppPrompt() {
  const { platform, canInstall, install, showIosModal, closeIosModal } = useInstallPrompt();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!canInstall) { setShow(false); return; }
    try {
      const ts = parseInt(localStorage.getItem(STORAGE_KEY_DISMISSED) || '', 10);
      if (!Number.isNaN(ts) && Date.now() - ts < DISMISS_TTL_DAYS * 24 * 3600 * 1000) return;
    } catch {/* ignore */}
    const delay = platform === 'ios' ? 5000 : 1500;
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [canInstall, platform]);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY_DISMISSED, String(Date.now())); } catch {}
    setShow(false);
  };

  const handleInstall = async () => {
    const result = await install();
    if (result === 'installed') setShow(false);
    else if (result === 'dismissed') dismiss();
  };

  return (
    <>
      {show && (
        <div className="install-prompt" role="dialog">
          <div className="install-prompt-icon"><Smartphone size={22} /></div>
          <div className="install-prompt-body">
            <strong>Instala a app JOY</strong>
            <p>Acesso rápido a partir do ecrã principal. Recebe notificações das tuas aulas.</p>
          </div>
          <div className="install-prompt-actions">
            <button className="install-prompt-skip" onClick={dismiss}>Agora não</button>
            <button className="install-prompt-accept" onClick={handleInstall}>
              <Download size={14} /> Instalar
            </button>
          </div>
          <button className="install-prompt-close" onClick={dismiss} aria-label="Fechar"><X size={14} /></button>
        </div>
      )}

      {showIosModal && <IosInstallModal onClose={closeIosModal} />}

      <style>{`
        .install-prompt {
          position: fixed; bottom: 5rem; left: 1rem; right: 1rem; max-width: 440px; margin: 0 auto;
          background: white; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.18);
          padding: 0.875rem 1rem; display: grid; grid-template-columns: auto 1fr auto;
          align-items: center; gap: 0.75rem; z-index: 1899;
          border: 1px solid var(--sand, #e5dfd4);
          animation: install-slide 0.35s ease-out;
        }
        @keyframes install-slide { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .install-prompt-icon { width: 40px; height: 40px; border-radius: 50%; background: rgba(124,154,114,0.12); color: var(--primary, #7c9a72); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .install-prompt-body { min-width: 0; }
        .install-prompt-body strong { display: block; font-size: 0.9375rem; }
        .install-prompt-body p { margin: 0.125rem 0 0; font-size: 0.8125rem; color: var(--text-secondary, #555); line-height: 1.35; }
        .install-prompt-actions { display: flex; gap: 0.4rem; flex-shrink: 0; }
        .install-prompt-skip { background: none; border: 1.5px solid var(--sand, #e5dfd4); border-radius: 8px; padding: 0.4rem 0.75rem; cursor: pointer; font-size: 0.8125rem; color: var(--text-secondary, #555); }
        .install-prompt-accept { background: var(--primary, #7c9a72); color: white; border: none; border-radius: 8px; padding: 0.4rem 0.875rem; cursor: pointer; font-size: 0.8125rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.3rem; }
        .install-prompt-accept:hover { background: var(--primary-dark, #5d7855); }
        .install-prompt-close { background: none; border: none; cursor: pointer; padding: 0.25rem; color: var(--text-muted, #999); position: absolute; top: 0.4rem; right: 0.4rem; display: none; }
        @media (max-width: 640px) {
          .install-prompt { grid-template-columns: auto 1fr; padding: 0.875rem; bottom: 4.5rem; }
          .install-prompt-actions { grid-column: 1 / -1; justify-content: flex-end; }
        }
      `}</style>
    </>
  );
}

/** Shared iOS instructions modal, exported so InstallAppButton can also render it. */
export function IosInstallModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="install-modal-overlay" onClick={onClose}>
      <div className="install-modal" onClick={e => e.stopPropagation()}>
        <button className="install-modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        <div className="install-modal-icon"><Smartphone size={28} /></div>
        <h3>Instalar no iPhone / iPad</h3>
        <p className="install-modal-subtitle">Em 3 passos rápidos:</p>
        <ol className="install-steps">
          <li>
            <span className="step-num">1</span>
            <span>Toca no botão <strong>Partilhar</strong> <Share size={14} style={{ verticalAlign: 'middle' }} /> em baixo do Safari</span>
          </li>
          <li>
            <span className="step-num">2</span>
            <span>Escolhe <strong>"Adicionar ao Ecrã Principal"</strong> <Plus size={14} style={{ verticalAlign: 'middle' }} /></span>
          </li>
          <li>
            <span className="step-num">3</span>
            <span>Toca em <strong>"Adicionar"</strong> no canto superior direito</span>
          </li>
        </ol>
        <div className="install-modal-note">
          💡 Depois de instalada, podes ativar notificações para saberes quando uma aula é cancelada ou substituída.
        </div>
        <button className="install-modal-ok" onClick={onClose}>Entendido</button>
      </div>

      <style>{`
        .install-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 1rem; animation: fadein 0.2s ease-out; }
        @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
        .install-modal { position: relative; background: white; border-radius: 20px; max-width: 420px; width: 100%; padding: 1.75rem 1.5rem 1.25rem; box-shadow: 0 20px 60px rgba(0,0,0,0.25); animation: install-modal-in 0.3s ease-out; }
        @keyframes install-modal-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .install-modal-close { position: absolute; top: 0.625rem; right: 0.625rem; background: none; border: none; cursor: pointer; padding: 0.3rem; color: var(--text-muted, #888); }
        .install-modal-icon { width: 56px; height: 56px; border-radius: 50%; background: rgba(124,154,114,0.12); color: var(--primary, #7c9a72); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.875rem; }
        .install-modal h3 { font-family: var(--font-heading, Georgia, serif); text-align: center; margin: 0 0 0.25rem; font-size: 1.25rem; }
        .install-modal-subtitle { text-align: center; color: var(--text-secondary, #555); margin: 0 0 1.25rem; font-size: 0.9375rem; }
        .install-steps { list-style: none; padding: 0; margin: 0 0 1rem; display: flex; flex-direction: column; gap: 0.625rem; }
        .install-steps li { display: flex; align-items: center; gap: 0.625rem; background: var(--bg-secondary, #faf8f5); border-radius: 12px; padding: 0.75rem 0.875rem; font-size: 0.9rem; line-height: 1.4; }
        .step-num { width: 26px; height: 26px; border-radius: 50%; background: var(--primary, #7c9a72); color: white; font-weight: 700; font-size: 0.875rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .install-modal-note { background: #fef3c7; border: 1px solid #fde68a; border-radius: 10px; padding: 0.625rem 0.875rem; font-size: 0.8125rem; color: #92400e; line-height: 1.45; margin-bottom: 1rem; }
        .install-modal-ok { width: 100%; background: var(--primary, #7c9a72); color: white; border: none; border-radius: 10px; padding: 0.75rem; font-weight: 600; font-size: 0.9375rem; cursor: pointer; }
        .install-modal-ok:hover { background: var(--primary-dark, #5d7855); }
      `}</style>
    </div>
  );
}
