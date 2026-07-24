import { useBackHandler } from '@/lib/backHandler';

/**
 * Full-screen image viewer. Tap anywhere (or press the phone's back button)
 * to close.
 */
export default function ImageViewer({ src, onClose }: { src: string; onClose: () => void }) {
  useBackHandler(onClose);

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/90 flex items-center justify-center p-3 animate-fade-in"
      onClick={onClose}
    >
      <img src={src} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
      <p className="absolute bottom-6 left-0 right-0 text-center text-white/60 text-xs">
        Toca para cerrar
      </p>
    </div>
  );
}
