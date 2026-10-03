import React, { useRef, useEffect } from 'react';
import { X, Terminal, Trash2, Copy } from 'lucide-react';

interface LiveConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: string[];
  onClearLogs: () => void;
}

export const LiveConsoleModal: React.FC<LiveConsoleModalProps> = ({
  isOpen,
  onClose,
  logs,
  onClearLogs,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-3xl h-[520px] minecraft-panel bg-[#120808] flex flex-col overflow-hidden text-stone-200">
        {/* Header */}
        <div className="h-12 px-4 flex items-center justify-between border-b-2 border-black bg-black/40">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-orange-400" />
            <span className="font-gamer font-bold text-sm tracking-wider text-white minecraft-text-shadow-lava">
              CONSOLA EN VIVO DE MINECRAFT
            </span>
            <span className="text-[10px] px-2 py-0.5 bg-black/60 border border-stone-800 text-stone-400">
              {logs.length} líneas
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1.5 minecraft-btn-gray text-stone-200 hover:text-white text-xs flex items-center gap-1 transition cursor-pointer"
              title="Copiar logs"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="text-[11px] minecraft-text-shadow-gray">Copiar</span>
            </button>
            <button
              onClick={onClearLogs}
              className="p-1.5 minecraft-btn-lava text-stone-200 hover:text-white text-xs flex items-center gap-1 transition cursor-pointer"
              title="Limpiar logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="text-[11px] minecraft-text-shadow-lava">Limpiar</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 minecraft-btn-lava text-stone-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Terminal output */}
        <div className="flex-1 p-4 overflow-y-auto text-[11px] leading-relaxed minecraft-slot bg-[#060404] text-stone-300 space-y-1 select-text">
          {logs.length === 0 ? (
            <div className="text-stone-600 italic">Esperando inicio del juego o logs del proceso...</div>
          ) : (
            logs.map((line, idx) => {
              const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('fatal');
              const isWarn = line.toLowerCase().includes('warn');
              return (
                <div
                  key={idx}
                  className={`break-all ${
                    isError ? 'text-red-400 font-semibold' : isWarn ? 'text-amber-300' : 'text-stone-300'
                  }`}
                >
                  {line}
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
};
