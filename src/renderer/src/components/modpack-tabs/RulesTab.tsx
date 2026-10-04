import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { renderSafeMarkdown } from '../../utils/safeMarkdown';
import { ModpackItem } from '../../vite-env';

interface RulesTabProps {
  rulesContent: string;
  modpackName: string;
  modpack: ModpackItem | null | undefined;
}

export const RulesTab: React.FC<RulesTabProps> = ({ rulesContent, modpackName, modpack }) => {
  return (
    <div className="relative z-10 w-full max-w-3xl max-h-[82%] overflow-y-auto minecraft-panel rounded-none p-6 sm:p-7 animate-in fade-in duration-200">
      <div className="flex items-center justify-between pb-4 border-b-2 border-black">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-none minecraft-slot text-cyan-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-minecraft font-bold text-lg text-white tracking-wide minecraft-text-shadow-lava">
              REGLAMENTO DEL SERVIDOR
            </h3>
            <p className="text-xs text-cyan-400/90 font-minecraft mt-0.5">
              Pautas y normas de convivencia de {modpackName}
            </p>
          </div>
        </div>
      </div>

      <div
        className="prose prose-invert max-w-none space-y-3 font-minecraft text-xs sm:text-sm text-stone-200 leading-relaxed pt-5
          [&>h1]:text-xl [&>h1]:font-bold [&>h1]:text-amber-400 [&>h1]:border-b [&>h1]:border-amber-600/40 [&>h1]:pb-2 [&>h1]:mb-3
          [&>h2]:text-base [&>h2]:font-bold [&>h2]:text-emerald-400 [&>h2]:mt-4 [&>h2]:mb-2
          [&>h3]:text-sm [&>h3]:font-bold [&>h3]:text-cyan-400
          [&>p]:text-stone-300 [&>p]:leading-relaxed
          [&>ul]:list-disc [&>ul]:list-inside [&>ul]:space-y-1.5 [&>ul>li]:text-stone-200
          [&>ol]:list-decimal [&>ol]:list-inside [&>ol]:space-y-1.5 [&>ol>li]:text-stone-200
          [&>blockquote]:border-l-4 [&>blockquote]:border-amber-500 [&>blockquote]:bg-amber-950/20 [&>blockquote]:p-3 [&>blockquote]:text-amber-300 [&>blockquote]:my-3
          [&>hr]:border-stone-800 [&>hr]:my-4
          [&>strong]:text-white [&>strong]:font-bold"
        dangerouslySetInnerHTML={{
          __html: rulesContent
            ? renderSafeMarkdown(rulesContent)
            : '<p class="text-stone-400 italic">No se han especificado normas para este modpack.</p>'
        }}
      />
    </div>
  );
};
