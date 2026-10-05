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
    <div className="relative z-10 w-full max-w-xl minecraft-panel rounded-none p-4 animate-in fade-in duration-200 text-center space-y-3">
      <div className="flex items-center justify-between pb-2.5 border-b-2 border-black text-left">
        <div>
          <h3 className="font-minecraft font-bold text-base text-white tracking-wide minecraft-text-shadow">
            COMUNIDAD DE DISCORD
          </h3>
          <p className="text-xs text-[#828bf7] font-minecraft mt-0.5">
            Servidor oficial de {modpackName}
          </p>
        </div>
      </div>

      <div className="p-4 minecraft-card border-[#5865F2]/50 bg-[#0f111c] space-y-3 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-none minecraft-slot text-[#828bf7] mx-auto flex items-center justify-center bg-black/60 border-[#5865F2]">
          <DiscordPixelIcon className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <h4 className="font-minecraft text-base font-bold text-white minecraft-text-shadow">
            {modpackName.toUpperCase()}
          </h4>
          <p className="text-xs text-stone-300 font-sans">
            Únete a nuestra comunidad para enterarte de eventos, actualizaciones y recibir soporte en vivo.
          </p>
        </div>

        {/* Botón Azul Minecraft 3D con ícono pixelado */}
        <div className="flex justify-center">
          <button
            onClick={() => {
              if (discordUrl) {
                window.open(discordUrl, '_blank');
              } else {
                alert('No se ha configurado la URL de Discord para este modpack.');
              }
            }}
            className="minecraft-btn-discord px-6 py-2.5 font-minecraft font-bold text-xs tracking-wider flex items-center justify-center gap-3 cursor-pointer shadow-xl hover:scale-105 transition"
          >
            <DiscordPixelIcon className="w-5 h-5" />
            <span>UNIRSE A DISCORD</span>
          </button>
        </div>

      </div>
    </div>
  );
};
