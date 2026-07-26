import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { runTopBackHandler } from '@/lib/backHandler';
import { useApp } from '@/contexts/AppContext';

/**
 * Handles the Android hardware/gesture back button:
 *  1. If an overlay/sub-view is open, close it.
 *  2. Otherwise, if not on the main view, go to the previous view.
 *  3. On the main view, require a second press within 2s to exit the app.
 */
export default function BackButtonManager() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useApp();

  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const lastBack = useRef(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;

    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', () => {
        if (runTopBackHandler()) return;

        if (pathRef.current !== '/') {
          navigate(-1);
          return;
        }

        const now = Date.now();
        if (now - lastBack.current < 2000) {
          App.exitApp();
        } else {
          lastBack.current = now;
          showToast('Pulsa atrás otra vez para salir', 'warning');
        }
      }).then((handle) => {
        remove = () => handle.remove();
      });
    });

    return () => remove?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
