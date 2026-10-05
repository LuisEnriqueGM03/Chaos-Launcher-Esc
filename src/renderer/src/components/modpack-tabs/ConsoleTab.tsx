import React, { useRef, useEffect, useState } from 'react';
import { Terminal, Trash2, Copy, Check } from 'lucide-react';

interface ConsoleTabProps {
  modpackName: string;
  logs: string[];
  onClearLogs: () => void;
  isGameRunning: boolean;
  keepLauncherOpen: boolean;
  onKeepLauncherOpenChange: (keep: boolean) => void;
}

const ERROR_RE = /\/(ERROR|FATAL)\]|\bException\b|\bFATAL\b|Failed to start|Couldn't start/;
const WARN_RE = /\/WARN\]|\bWARNING\b/;

export const ConsoleTab: React.FC<ConsoleTabProps> = ({
  modpackName,
  logs,
  onClearLogs,
  isGameRunning,
  keepLauncherOpen,
  onKeepLauncherOpenChange,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Si el jugador sube para leer, la consola deja de arrastrarlo al final
  const stickToBottom = useRef(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (stickToBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(logs.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Portapapeles no disponible
    }
  };

  return (
    <div className="relative z-10 w-full max-w-4xl h-[78%] flex flex-col minecraft-panel rounded-none p-5 sm:p-6 animate-in fade-in duration-200">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b-2 border-black shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-none minecraft-slot text-orange-400 shrink-0">
            <Terminal className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h3 className="font-minecraft font-bold text-lg text-white tracking-wide minecraft-text-shadow-lava truncate">
              CONSOLA
            </h3>
            <p className="text-xs text-amber-400 font-minecraft mt-0.5 truncate">
              Salida de {modpackName} en tiempo real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`flex items-center gap-1.5 text-[10px] font-minecraft px-2 py-1 bg-black/60 border border-stone-800 ${
              isGameRunning ? 'text-emerald-400' : 'text-stone-500'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isGameRunning ? 'bg-emerald-400 animate-pulse' : 'bg-stone-600'}`} />
            {isGameRunning ? 'EN EJECUCIÓN' : 'DETENIDO'}
          </span>
          <button
            onClick={handleCopy}
            className="p-1.5 minecraft-btn-gray text-stone-200 hover:text-white text-xs flex items-center gap-1 transition cursor-pointer"
            title="Copiar todo el registro"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="text-[11px] minecraft-text-shadow-gray">{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
          <button
            onClick={onClearLogs}
            className="p-1.5 minecraft-btn-lava text-stone-200 hover:text-white text-xs flex items-center gap-1 transition cursor-pointer"
            title="Limpiar la consola"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="text-[11px] minecraft-text-shadow-lava">Limpiar</span>
          </button>
        </div>
      </div>

      {/* Salida */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 mt-3 p-3 overflow-y-auto text-[11px] leading-relaxed font-mono minecraft-slot bg-[#060404] text-stone-300 select-text"
      >
        {logs.length === 0 ? (
          <div className="text-stone-600 italic">
            Aquí aparecerá la salida del juego en tiempo real cuando le des a Jugar...
          </div>
        ) : (
          logs.map((line, idx) => (
            <div
              key={idx}
              className={`whitespace-pre-wrap break-all ${
                ERROR_RE.test(line) ? 'text-red-400 font-semibold' : WARN_RE.test(line) ? 'text-amber-300' : 'text-stone-300'
              }`}
            >
              {line}
            </div>
          ))
        )}
      </div>

      {/* Pie */}
      <div className="flex items-center justify-between gap-3 pt-3 shrink-0 text-[11px] text-stone-400">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={keepLauncherOpen}
            onChange={(e) => onKeepLauncherOpenChange(e.target.checked)}
            className="accent-orange-500 cursor-pointer"
          />
          <span>Mantener el launcher abierto al jugar (para seguir viendo la consola)</span>
        </label>
        <span className="text-stone-500 hidden sm:inline">{logs.length} líneas</span>
      </div>
    </div>
  );
};
