import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, Check, Loader2, Info, RefreshCw } from 'lucide-react';
import { SkinViewer, WalkingAnimation, IdleAnimation } from 'skinview3d';
import { UserAccount, SkinInfo } from '../vite-env';

interface SkinModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: UserAccount | null;
}

type Variant = 'classic' | 'slim';

export const SkinModal: React.FC<SkinModalProps> = ({ isOpen, onClose, account }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);

  const [info, setInfo] = useState<SkinInfo | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [variant, setVariant] = useState<Variant>('classic');
  const [walking, setWalking] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isPremium = account?.type === 'microsoft';
  const previewSrc = pending ?? info?.dataUrl ?? null;
  const canEdit = !!info?.canEdit;

  // Carga la skin actual cada vez que se abre el modal
  useEffect(() => {
    if (!isOpen || !account) return;
    let cancelled = false;
    setInfo(null);
    setPending(null);
    setError(null);
    setSuccess(null);
    setLoading(true);
    window.chaosAPI.skin
      .get()
      .then((res) => {
        if (cancelled) return;
        setInfo(res);
        setVariant(res.variant);
      })
      .catch((e: any) => !cancelled && setError(e?.message || 'No se pudo cargar la skin.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isOpen, account?.id]);

  // Crea / destruye el visor 3D
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width: 240,
      height: 320,
      background: 0x0b0606,
    });
    viewer.fov = 40;
    viewer.zoom = 0.85;
    viewer.autoRotateSpeed = 0.6;
    viewerRef.current = viewer;
    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [isOpen]);

  // Actualiza textura/modelo
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !previewSrc) return;
    viewer.loadSkin(previewSrc, { model: variant === 'slim' ? 'slim' : 'default' }).catch(() => {
      setError('No se pudo mostrar la skin.');
    });
  }, [previewSrc, variant, isOpen]);

  useEffect(() => {
    if (viewerRef.current) viewerRef.current.autoRotate = autoRotate;
  }, [autoRotate, isOpen]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.animation = walking ? new WalkingAnimation() : new IdleAnimation();
  }, [walking, isOpen]);

  if (!isOpen || !account) return null;

  const handlePick = async () => {
    setError(null);
    setSuccess(null);
    try {
      const dataUrl = await window.chaosAPI.skin.pick();
      if (dataUrl) setPending(dataUrl);
    } catch (e: any) {
      setError(e?.message || 'No se pudo abrir la imagen.');
    }
  };

  const handleRenew = async () => {
    setRenewing(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await window.chaosAPI.skin.renewSession();
      setInfo(updated);
      setVariant(updated.variant);
      if (updated.canEdit) setSuccess('Sesión renovada. Ya puedes cambiar tu skin.');
    } catch (e: any) {
      setError(e?.message || 'No se pudo renovar la sesión.');
    } finally {
      setRenewing(false);
    }
  };

  const handleApply = async () => {
    if (!pending && variant === info?.variant) return;
    const source = pending ?? info?.dataUrl;
    if (!source) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await window.chaosAPI.skin.apply(source, variant);
      setInfo(updated);
      setPending(null);
      setSuccess(
        isPremium
          ? '¡Skin actualizada! Se verá en Minecraft la próxima vez que entres.'
          : 'Skin guardada en el launcher.'
      );
    } catch (e: any) {
      setError(e?.message || 'No se pudo aplicar la skin.');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = !!pending || variant !== info?.variant;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="minecraft-panel w-full max-w-xl p-5 space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-slate-400 hover:text-white cursor-pointer"
          title="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <h2 className="font-minecraft text-sm font-bold text-white minecraft-text-shadow-lava">CAMBIAR SKIN</h2>
          <p className="text-[11px] text-slate-400 font-minecraft mt-0.5">
            {account.name} · {isPremium ? 'Premium' : 'Offline'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Visor 3D */}
          <div className="minecraft-slot p-0 shrink-0 self-center relative" style={{ width: 240, height: 320 }}>
            <canvas ref={canvasRef} className="block" />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
              </div>
            )}
          </div>

          {/* Controles */}
          <div className="flex-1 space-y-3 min-w-0">
            <button
              onClick={handlePick}
              disabled={!canEdit || saving}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 minecraft-btn-gray text-white font-minecraft text-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>ELEGIR PNG (64x64)</span>
            </button>

            <div>
              <div className="text-[10px] font-minecraft uppercase tracking-wider text-amber-400/90 mb-1">Modelo</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(['classic', 'slim'] as Variant[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVariant(v)}
                    disabled={!canEdit || saving}
                    className={`py-1.5 text-[11px] font-minecraft cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      variant === v ? 'minecraft-btn-lava text-white' : 'minecraft-btn-gray text-slate-300'
                    }`}
                  >
                    {v === 'classic' ? 'Steve (brazo 4px)' : 'Alex (brazo 3px)'}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-[11px] font-minecraft text-slate-300 cursor-pointer select-none">
              <input type="checkbox" checked={walking} onChange={(e) => setWalking(e.target.checked)} />
              Animación de caminar
            </label>

            <label className="flex items-center gap-2 text-[11px] font-minecraft text-slate-300 cursor-pointer select-none">
              <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
              Rotación automática
            </label>

            <p className="text-[10px] text-slate-500 font-minecraft">Arrastra el muñeco para girarlo.</p>

            {info?.notice && (
              <div className="flex gap-2 p-2 minecraft-slot text-[10px] text-amber-300 font-minecraft leading-snug">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{info.notice}</span>
              </div>
            )}
            {isPremium && info && !info.canEdit && (
              <button
                onClick={handleRenew}
                disabled={renewing}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 minecraft-btn-amber text-white font-minecraft text-xs disabled:opacity-50 cursor-pointer"
              >
                {renewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>RENOVAR SESIÓN</span>
              </button>
            )}
            {error && <div className="p-2 minecraft-slot text-[11px] text-red-400 font-minecraft">{error}</div>}
            {success && (
              <div className="p-2 minecraft-slot text-[11px] text-emerald-400 font-minecraft flex gap-2">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{success}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 minecraft-btn-gray text-white font-minecraft text-xs cursor-pointer"
          >
            CERRAR
          </button>
          <button
            onClick={handleApply}
            disabled={!canEdit || !hasChanges || saving}
            className="px-4 py-2 minecraft-btn-green text-white font-minecraft text-xs minecraft-text-shadow flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isPremium ? 'APLICAR EN MINECRAFT' : 'GUARDAR SKIN'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
