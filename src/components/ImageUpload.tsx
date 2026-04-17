import React, { useRef, useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { Upload, X, Loader, Image } from 'lucide-react';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  folder: string; // e.g. 'professors', 'locations', 'events'
  label?: string;
}

export function ImageUpload({ value, onChange, folder, label = 'Foto' }: ImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith('image/')) {
      setError('Seleciona uma imagem (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem demasiado grande (máx 5MB)');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const filename = `${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      onChange(url);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError('Erro ao carregar imagem. Verifica as permissões do Firebase Storage.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange('');
  };

  return (
    <div className="image-upload">
      <label className="label">{label}</label>

      {value ? (
        <div className="image-preview">
          <img src={value} alt="Preview" />
          <button className="remove-btn" onClick={handleRemove} title="Remover foto">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          className={`upload-area ${uploading ? 'uploading' : ''}`}
          onClick={() => !uploading && fileRef.current?.click()}
        >
          {uploading ? (
            <>
              <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
              <span>A carregar...</span>
            </>
          ) : (
            <>
              <Upload size={24} />
              <span>Clica para carregar foto</span>
              <span className="upload-hint">JPG, PNG ou WebP (máx 5MB)</span>
            </>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        style={{ display: 'none' }}
      />

      {error && <p className="upload-error">{error}</p>}

      <style>{`
        .image-upload { margin-bottom: 1.5rem; }
        .image-preview { position: relative; display: inline-block; border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
        .image-preview img { display: block; max-width: 200px; max-height: 200px; object-fit: cover; border-radius: var(--radius-lg); }
        .remove-btn { position: absolute; top: 0.375rem; right: 0.375rem; width: 28px; height: 28px; border-radius: 50%; background: rgba(0,0,0,0.6); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background var(--transition-fast); }
        .remove-btn:hover { background: var(--error); }
        .upload-area { border: 2px dashed var(--sand); border-radius: var(--radius-lg); padding: 2rem; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; cursor: pointer; color: var(--text-muted); transition: all var(--transition-fast); background: var(--bg-secondary); }
        .upload-area:hover { border-color: var(--primary); color: var(--primary); background: rgba(124,154,114,0.05); }
        .upload-area.uploading { cursor: wait; border-color: var(--primary); }
        .upload-area span { font-size: 0.875rem; }
        .upload-hint { font-size: 0.75rem !important; color: var(--text-muted) !important; }
        .upload-error { color: var(--error); font-size: 0.8125rem; margin-top: 0.375rem; }
      `}</style>
    </div>
  );
}
