import React from 'react';
import { Clock } from 'lucide-react';
import { ModpackItem, ModpackManifest } from '../../vite-env';

interface ChangelogTabProps {
  modpack: ModpackItem | null | undefined;
  changelogList: string[];
  manifest: ModpackManifest | null;
}

export const ChangelogTab: React.FC<ChangelogTabProps> = ({ modpack, changelogList, manifest }) => {
  return (
    <div className="relative z-10 w-full max-w-3xl max-h-[82%] overflow-y-auto minecraft-panel rounded-none p-6 sm:p-7 animate-in fade-in duration-200 space-y-4">
      <div className="flex items-center justify-between pb-4 border-b-2 border-black">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-none minecraft-slot text-purple-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-minecraft font-bold text-lg text-white tracking-wide minecraft-text-shadow-lava">
              NOTAS DE LA VERSIÓN (v{manifest?.version || modpack?.version || '1.0.0'})
            </h3>
            <p className="text-xs text-purple-400/90 font-minecraft mt-0.5">
              Historial de actualizaciones y mejoras
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        {changelogList.length > 0 ? (
          changelogList.map((item, idx) => (
            <div
              key={idx}
              className="minecraft-slot p-3.5 flex items-start gap-3 bg-[#0f0707] border-stone-800"
            >
              <span className="text-purple-400 font-minecraft text-sm shrink-0 mt-0.5">◆</span>
              <span className="text-xs sm:text-sm text-stone-200 font-minecraft leading-relaxed">
                {item}
              </span>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-xs font-minecraft text-stone-400">
            No hay notas de versión registradas para esta entrega.
          </div>
        )}
      </div>
    </div>
  );
};
