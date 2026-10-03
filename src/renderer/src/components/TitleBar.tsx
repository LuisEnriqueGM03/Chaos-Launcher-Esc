import React from 'react';
import { Minus, Square, X } from 'lucide-react';
import logoTransparent from '../assets/logo_transparent.png';

interface TitleBarProps {
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onMinimize, onMaximize, onClose }) => {
  return (
    <div className="h-9 w-full flex items-center justify-between px-3 bg-[#0a0606] border-b-2 border-[#180808] titlebar-drag-region z-50">
      {/* Logo & Brand */}
      <div className="flex items-center gap-2">
        <img
          src={logoTransparent}
          alt="Chaos Logo"
          className="w-4 h-4 object-contain filter drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]"
        />
        <span className="font-minecraft font-bold tracking-widest text-xs text-white minecraft-text-shadow-lava">
          CHAOS LAUNCHER
        </span>
      </div>

      {/* Window Controls */}
      <div className="flex items-center gap-1 titlebar-no-drag">
        <button
          onClick={onMinimize}
          className="w-7 h-6 flex items-center justify-center rounded-none hover:bg-[#2e1010] text-slate-400 hover:text-white transition active:translate-y-0.5 border border-transparent hover:border-black"
          title="Minimizar"
        >
          <Minus className="w-3 h-3" />
        </button>
        <button
          onClick={onMaximize}
          className="w-7 h-6 flex items-center justify-center rounded-none hover:bg-[#2e1010] text-slate-400 hover:text-white transition active:translate-y-0.5 border border-transparent hover:border-black"
          title="Maximizar"
        >
          <Square className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={onClose}
          className="w-7 h-6 flex items-center justify-center rounded-none hover:bg-[#801818] text-slate-400 hover:text-white transition active:translate-y-0.5 border border-transparent hover:border-black"
          title="Cerrar"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
