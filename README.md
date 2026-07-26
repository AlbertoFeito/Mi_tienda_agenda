# Mi Tienda — App Android nativa (SQLite local, offline)

Aplicación de gestión comercial para pequeños negocios (productos, ventas,
clientes, cuotas/fiado, análisis) empaquetada como **app Android nativa** con
[Capacitor](https://capacitorjs.com/).

- **100% offline**: no solicita permiso de internet, no puede acceder a la red.
- **Un solo usuario**: sin cuentas ni sincronización.
- **Persistencia en SQLite local**: los datos viven en una base de datos SQLite
  en el propio dispositivo, mediante
  [`@capacitor-community/sqlite`](https://github.com/capacitor-community/sqlite).

La interfaz está construida en React + TypeScript + Vite + Tailwind y se ejecuta
dentro de la WebView nativa de Android.

## Arquitectura de datos

Toda la lógica de datos pasa por una única capa (`src/lib/`):

| Archivo | Rol |
| --- | --- |
| `src/lib/store.ts` | Backend de almacenamiento. En el APK usa **SQLite nativo**. En el navegador (desarrollo/tests) usa un respaldo en `localStorage` con la misma interfaz. |
| `src/lib/db.ts` | API de tablas (`toArray/get/add/update/delete/count/clear/bulkAdd/where`) que consumen las pantallas, más `initDatabase`, `exportData`, `importData`, `clearAllData`. |
| `src/lib/live.ts` | `useLiveQuery` reactivo: refresca las vistas tras cada escritura. |

Cada tabla se guarda con el modelo `(id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT)`
donde `data` es el registro en JSON. En el dispositivo el archivo SQLite lo
gestiona el plugin nativo.

## Desarrollo (navegador)

```bash
npm install
npm run dev      # http://localhost:3000  (usa el respaldo localStorage)
npm test         # tests con Vitest + jsdom
npm run build    # type-check + bundle de producción en dist/
```

## Compilar el APK de Android

Requisitos: JDK 21, Android SDK (platform-tools, `platforms;android-35`,
`build-tools;35.0.0`) y Gradle 8.14+.

```bash
# 1) Construir el bundle web y copiarlo al proyecto Android
npm run cap:sync

# 2) Generar el APK de depuración
cd android
gradle assembleDebug        # o ./gradlew assembleDebug si tienes el wrapper

# APK resultante:
# android/app/build/outputs/apk/debug/app-debug.apk
```

Atajo equivalente: `npm run android:apk`.

Para una versión de release firmada, configura un keystore y usa
`gradle assembleRelease`.

## Instalar en el teléfono

1. Copia `app-debug.apk` al teléfono (cable USB, o compártelo por Bluetooth /
   nube y descárgalo en el dispositivo).
2. En el teléfono, abre el archivo con el explorador de archivos.
3. Acepta **"Instalar apps de fuentes desconocidas"** para tu explorador de
   archivos si Android lo pide.
4. Pulsa **Instalar**. Aparecerá como **Mi Tienda**.

Alternativa con cable y `adb`:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Identidad de la app

- **Nombre**: Mi Tienda
- **applicationId**: `com.mitienda.app`
- **minSdk**: 24 · **targetSdk / compileSdk**: 35
