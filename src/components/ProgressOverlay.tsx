import { Loader2 } from 'lucide-react';
import Portal from '@/components/Portal';

/**
 * Covers the screen while something slow is happening.
 *
 * Deleting nine hundred customers takes a while, and without this the app just
 * sits there: no way to tell it apart from a crash, and every tap during the
 * wait lands on a button that should not be pressed twice. So it says what it
 * is doing, how far along it is, and swallows everything underneath.
 *
 * There is no way out on purpose — no back, no tap to dismiss. Half a deletion
 * is worse than a slow one.
 *
 * With `total`, it shows real progress. Without, it just spins: for work that
 * happens in one go, a bar that jumps from nothing to everything would be a
 * lie.
 */
export default function ProgressOverlay({
  title,
  done,
  total,
  note,
}: {
  title: string;
  done?: number;
  total?: number;
  note?: string;
}) {
  const measurable = typeof total === 'number' && total > 0 && typeof done === 'number';
  const percent = measurable ? Math.min(100, Math.round((done! / total!) * 100)) : 0;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[650] bg-black/50 flex items-center justify-center p-6"
        // Nothing underneath should react while this is up.
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center">
          <Loader2 size={32} className="mx-auto text-[#0F766E] animate-spin mb-3" />
          <p className="text-base font-semibold text-[#0F172A]">{title}</p>

          {measurable && (
            <>
              <p className="text-sm text-[#475569] mt-1 tabular-nums">
                {done} de {total}
              </p>
              <div className="w-full h-2 bg-[#E2E8F0] rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-[#0F766E] rounded-full transition-all duration-150"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </>
          )}

          <p className="text-xs text-[#94A3B8] mt-3">{note ?? 'No cierres la aplicación.'}</p>
        </div>
      </div>
    </Portal>
  );
}
