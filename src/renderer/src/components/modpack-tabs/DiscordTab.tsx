import React from 'react';
import { DiscordPixelIcon } from '../DiscordPixelIcon';
import { ModpackItem } from '../../vite-env';

interface DiscordTabProps {
  modpackName: string;
  modpack: ModpackItem | null | undefined;
  discordUrl: string;
}

export const DiscordTab: React.FC<DiscordTabProps> = ({ modpackName, modpack, discordUrl }) => {
  return (
    <div className="relative z-10 w-full max-w-2xl max-h-[82%] overflow-y-auto minecraft-panel rounded-none p-6 sm:p-7 animate-in fade-in duration-200 text-center space-y-6">
      <div className="flex items-center justify-between pb-4 border-b-2 border-black text-left">
        <div>
          <h3 className="font-minecraft font-bold text-lg text-white tracking-wide minecraft-text-shadow">
            COMUNIDAD DE DISCORD
          </h3>
          <p className="text-xs text-[#828bf7] font-minecraft mt-0.5">
            Servidor oficial de {modpackName}
          </p>
        </div>
      </div>

      <div className="p-8 minecraft-card border-[#5865F2]/50 bg-[#0f111c] space-y-6 max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-none minecraft-slot text-[#828bf7] mx-auto flex items-center justify-center bg-black/60 border-[#5865F2]">
          <DiscordPixelIcon className="w-10 h-10" />
        </div>

        <div className="space-y-1.5">
          <h4 className="font-minecraft text-xl font-bold text-white minecraft-text-shadow">
            {modpackName.toUpperCase()}
          </h4>
          <p className="text-xs text-stone-300 font-sans">
            Únete a nuestra comunidad para enterarte de eventos, actualizaciones y recibir soporte en vivo.
          </p>
        </div>

        {/* Botón Azul Minecraft 3D con ícono pixelado */}
        <div className="pt-2 flex justify-center">
          <button
            onClick={() => {
              if (discordUrl) {
                window.open(discordUrl, '_blank');
              } else {
                alert('No se ha configurado la URL de Discord para este modpack.');
              }
            }}
            className="minecraft-btn-discord px-8 py-4 font-minecraft font-bold text-sm tracking-wider flex items-center justify-center gap-3 cursor-pointer shadow-xl hover:scale-105 transition"
          >
            <DiscordPixelIcon className="w-6 h-6" />
            <span>UNIRSE A DISCORD</span>
          </button>
        </div>

        {discordUrl && (
          <span className="text-[10px] font-mono text-stone-400 block pt-1 truncate">
            {discordUrl}
          </span>
        )}
      </div>
    </div>
  );
};
