import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import HelpModal from '@/components/HelpModal';

/**
 * Inline "?" that opens the help straight on one topic. For the spots where a
 * doubt actually shows up — the consignment prices, the installment plan, the
 * owner settlement — rather than making the user go find it in the index.
 */
export default function HelpButton({ topicId, label }: { topicId: string; label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label ? undefined : 'Ayuda'}
        className="flex-shrink-0 inline-flex items-center gap-1 text-[#0F766E] text-xs font-medium px-2 py-1 rounded-lg active:scale-95 transition-transform"
      >
        <HelpCircle size={15} />
        {label}
      </button>
      {open && <HelpModal topicId={topicId} onClose={() => setOpen(false)} />}
    </>
  );
}
