import { useMemo, useState } from 'react';
import Portal from '@/components/Portal';
import { Capacitor } from '@capacitor/core';
import { Search, ChevronRight, Share2, GraduationCap, HelpCircle } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useBackHandler } from '@/lib/backHandler';
import {
  HELP_TOPICS,
  buildHelpManual,
  searchTopics,
  topicById,
  topicForRoute,
  type HelpTopic,
} from '@/lib/help';

/**
 * Help for the screen the user is standing on, with the full index underneath.
 * Opens straight into the current screen's topic so the common case — "what is
 * this screen for" — takes one tap and no reading of a menu.
 */
export default function HelpModal({
  route,
  topicId,
  onClose,
  onReplayTour,
}: {
  /** Screen the user is on; its topic opens first. */
  route?: string;
  /** Opens straight on this topic, whatever screen we came from. */
  topicId?: string;
  onClose: () => void;
  onReplayTour?: () => void;
}) {
  const { settings, showToast } = useApp();
  const [query, setQuery] = useState('');
  const [openTopic, setOpenTopic] = useState<HelpTopic | null>(
    () => (topicId ? topicById(topicId) : route ? topicForRoute(route) : undefined) ?? null,
  );

  const results = useMemo(() => searchTopics(query), [query]);

  useBackHandler(() => {
    if (openTopic) setOpenTopic(null);
    else onClose();
  });

  const shareManual = async () => {
    const text = buildHelpManual(settings?.storeName || 'NayadeStore');
    try {
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title: 'Manual', text });
      } else if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard?.writeText(text);
        showToast('Manual copiado', 'success');
      }
    } catch {
      /* user cancelled the share sheet */
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[300] bg-[#F8FAFC] flex flex-col animate-slide-up">
        <div className="h-14 bg-[#134E4A] text-white flex items-center px-4 flex-shrink-0">
          <h2 className="text-lg font-semibold truncate">{openTopic ? openTopic.title : 'Ayuda'}</h2>
        </div>

        {openTopic ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <p className="text-[15px] leading-relaxed text-[#0F172A]">{openTopic.summary}</p>

            {openTopic.steps?.length ? (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-sm font-semibold text-[#0F172A] mb-3">Paso a paso</p>
                <ol className="space-y-2.5">
                  {openTopic.steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0F766E] text-white text-xs font-semibold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-sm text-[#334155] leading-relaxed pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {openTopic.notes?.length ? (
              <div className="bg-[#F0FDFA] border border-[#0F766E]/15 rounded-xl p-4">
                <p className="text-sm font-semibold text-[#0F766E] mb-2">Ten en cuenta</p>
                <ul className="space-y-2">
                  {openTopic.notes.map((note, i) => (
                    <li key={i} className="text-sm text-[#334155] leading-relaxed flex gap-2">
                      <span className="text-[#0F766E]">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button
              onClick={() => setOpenTopic(null)}
              className="w-full h-12 border-2 border-[#0F766E] text-[#0F766E] rounded-xl font-medium active:scale-[0.98] transition-transform"
            >
              Ver todos los temas
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar en la ayuda..."
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-[#E2E8F0] bg-white text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
              />
            </div>

            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-center">
                <HelpCircle className="w-12 h-12 mb-3" />
                <p className="font-medium text-gray-500">No encontré nada sobre eso</p>
                <p className="text-sm mt-1">Prueba con otra palabra, como “dueño” o “copia”.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm divide-y divide-[#F1F5F9] overflow-hidden">
                {results.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => setOpenTopic(topic)}
                    className="w-full flex items-center gap-3 p-4 text-left active:bg-[#F1F5F9] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#0F172A]">{topic.title}</p>
                      <p className="text-xs text-[#94A3B8] mt-0.5 line-clamp-2">{topic.summary}</p>
                    </div>
                    <ChevronRight size={18} className="text-[#94A3B8] flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2 pt-2">
              {onReplayTour && (
                <button
                  onClick={onReplayTour}
                  className="w-full h-12 flex items-center justify-center gap-2 border-2 border-[#0F766E] text-[#0F766E] rounded-xl font-medium active:scale-[0.98] transition-transform"
                >
                  <GraduationCap size={18} />
                  Ver el recorrido inicial
                </button>
              )}
              <button
                onClick={shareManual}
                className="w-full h-12 flex items-center justify-center gap-2 border border-[#E2E8F0] text-[#475569] rounded-xl font-medium active:scale-[0.98] transition-transform"
              >
                <Share2 size={18} />
                Compartir el manual
              </button>
            </div>

            <p className="text-xs text-[#94A3B8] text-center pt-2">
              {HELP_TOPICS.length} temas · funciona sin internet
            </p>
          </div>
        )}
      </div>
    </Portal>
  );
}
