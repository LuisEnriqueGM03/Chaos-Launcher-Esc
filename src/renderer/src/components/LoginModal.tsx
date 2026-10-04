import React, { useState } from 'react';
import { X, Flame, User, Globe, AlertCircle, Loader2 } from 'lucide-react';
import logoTransparent from '../assets/logo_transparent.png';
import { formatFriendlyError } from '../utils/errorFormatter';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginOffline: (username: string) => Promise<void>;
  onLoginMicrosoft: () => Promise<void>;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginOffline,
  onLoginMicrosoft,
}) => {
  const [tab, setTab] = useState<'offline' | 'microsoft'>('offline');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOfflineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Por favor escribe tu apodo de Minecraft.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onLoginOffline(username.trim());
      onClose();
    } catch (err: any) {
      setError(formatFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await onLoginMicrosoft();
      onClose();
    } catch (err: any) {
      if (err?.message?.includes('cancelado') || err?.message?.includes('cancel') || err?.message?.includes('closed')) {
        return;
      }
      setError(formatFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const previewNick = username.trim() || 'Steve';
  const previewSkin = `https://mc-heads.net/avatar/${encodeURIComponent(previewNick)}/100`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-none minecraft-panel p-6 overflow-hidden">
        {/* Decorative Top Glow Lava */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-red-600" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <img
              src={logoTransparent}
              alt="Chaos"
              className="w-8 h-8 object-contain filter drop-shadow-[0_0_8px_rgba(255,60,0,0.8)]"
            />
            <div>
              <h3 className="font-minecraft font-bold text-base text-white tracking-wide minecraft-text-shadow-lava">
                ACCESO A CHAOS LAUNCHER
              </h3>
              <p className="text-xs text-slate-400 font-minecraft">Elige tu cuenta de juego</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="minecraft-btn-lava p-1.5 rounded-none text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex rounded-none bg-black p-1 mb-5 border-2 border-black gap-1">
          <button
            type="button"
            onClick={() => { setTab('offline'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-none text-xs font-minecraft tracking-wider transition cursor-pointer ${
              tab === 'offline'
                ? 'minecraft-btn-lava text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>No Premium</span>
          </button>

          <button
            type="button"
            onClick={() => { setTab('microsoft'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-none text-xs font-minecraft tracking-wider transition cursor-pointer ${
              tab === 'microsoft'
                ? 'minecraft-btn-lava text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Premium</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-none minecraft-card border-red-500/50 text-red-300 text-xs font-minecraft">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab 1: No Premium */}
        {tab === 'offline' && (
          <form onSubmit={handleOfflineSubmit} className="space-y-4">
            <div className="flex items-center gap-4 p-3.5 rounded-none minecraft-card">
              <div className="w-12 h-12 rounded-none minecraft-slot flex items-center justify-center shrink-0">
                <img
                  src={previewSkin}
                  alt="Skin Preview"
                  className="w-10 h-10 object-cover shadow"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/Steve/100';
                  }}
                />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-minecraft font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Tu Apodo / Nickname
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej. Steve_Nether"
                  maxLength={16}
                  className="w-full px-3 py-2 rounded-none minecraft-input text-white text-xs outline-none transition placeholder:text-slate-600"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-none minecraft-btn-green text-white font-minecraft font-bold tracking-wider text-sm uppercase disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer minecraft-text-shadow"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>GUARDANDO SESIÓN...</span>
                </>
              ) : (
                <span>ENTRAR A JUGAR</span>
              )}
            </button>
          </form>
        )}

        {/* Tab 2: Microsoft Premium */}
        {tab === 'microsoft' && (
          <div className="space-y-4">
            <div className="p-5 rounded-none minecraft-card space-y-2 text-center">
              <div className="w-12 h-12 mx-auto rounded-none minecraft-slot flex items-center justify-center text-amber-400">
                <Globe className="w-6 h-6" />
              </div>
              <h4 className="font-minecraft font-bold text-white text-sm minecraft-text-shadow-lava">
                Cuenta Premium Microsoft
              </h4>
              <p className="text-xs text-slate-400 font-minecraft">
                Inicia sesión de forma segura con tu cuenta de Microsoft / Mojang
              </p>
            </div>

            <button
              type="button"
              onClick={handleMicrosoftLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-none minecraft-btn-green text-white font-minecraft font-bold tracking-wider text-sm uppercase disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer minecraft-text-shadow"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>AUTENTICANDO CON MICROSOFT...</span>
                </>
              ) : (
                <span>INICIAR CON MICROSOFT</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
