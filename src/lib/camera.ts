import { Capacitor } from '@capacitor/core';

/**
 * Obtain a product image as a base64 data URL.
 *
 * On the native Android build it uses the Capacitor Camera plugin, which lets
 * the user choose between the device camera and the photo gallery and handles
 * the runtime permission prompt. The result is returned as a data URL so it can
 * be stored directly in the product record (in the local SQLite database) and
 * rendered with a plain `<img src=...>`.
 *
 * In a browser (development / tests) it falls back to a standard file picker.
 *
 * Returns `undefined` if the user cancels or the image can't be read.
 */
export async function pickProductImage(): Promise<string | undefined> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        quality: 70,
        width: 800,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        promptLabelHeader: 'Imagen del producto',
        promptLabelCancel: 'Cancelar',
        promptLabelPhoto: 'Elegir de la galería',
        promptLabelPicture: 'Tomar foto',
      });
      return photo.dataUrl;
    } catch {
      // User cancelled the prompt or denied permission.
      return undefined;
    }
  }

  return pickImageFromFileInput();
}

function pickImageFromFileInput(): Promise<string | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(undefined);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
