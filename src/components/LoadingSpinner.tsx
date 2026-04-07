import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
}

export function LoadingSpinner({ size = 'md', fullPage = false }: LoadingSpinnerProps) {
  const sizeMap = { sm: 24, md: 40, lg: 56 };

  const spinner = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        className="spinner"
        style={{ width: sizeMap[size], height: sizeMap[size] }}
      />
    </div>
  );

  if (fullPage) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-secondary)', zIndex: 9999
      }}>
        {spinner}
      </div>
    );
  }

  return spinner;
}
