import React from 'react';
import { Download } from 'lucide-react';
import { useInstallPrompt } from '../services/installPwa';
import { IosInstallModal } from './InstallAppPrompt';

/**
 * Persistent "Install app" button for sidebars.
 * Hides if app is already installed (standalone mode) or if browser doesn't support install.
 */
export function InstallAppButton({
  className,
  iconClassName,
  labelClassName,
  label = 'Instalar app',
}: {
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  label?: string;
}) {
  const { canInstall, install, showIosModal, closeIosModal } = useInstallPrompt();
  if (!canInstall) return null;

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => { void install(); }}
        title="Adicionar ao ecrã principal"
      >
        <Download size={18} className={iconClassName} />
        <span className={labelClassName}>{label}</span>
      </button>
      {showIosModal && <IosInstallModal onClose={closeIosModal} />}
    </>
  );
}
