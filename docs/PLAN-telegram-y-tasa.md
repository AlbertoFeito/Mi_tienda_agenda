# Publicar en Telegram y buscar la tasa del día

> **Estado: diseñado, no construido.** Se investigó y se decidió en agosto de
> 2026, y se aparcó para más adelante. Este documento existe para no tener que
> volver a investigarlo desde cero. No hay ni una línea de esto en la app.

## Qué se quería

Un *publishing bot*: anunciar automáticamente los productos que tienen stock,
para que las clientas los vean sin que haya que escribirles una por una.

Y, aparte, dejar de escribir la tasa de cambio a mano.

## Por qué Telegram y no WhatsApp

WhatsApp se descartó con razones concretas, no por gusto:

- **La API oficial** pide verificación de empresa con Meta y una tarjeta
  internacional para pagar por conversación. Desde Cuba eso está bloqueado, y
  los proveedores no aceptan números +53.
- **Las librerías no oficiales** (Baileys, whatsapp-web.js) sí funcionan, pero
  violan los términos de WhatsApp y **banean el número** — que sería el del
  negocio, el que tienen todas las clientas. Además exigen una máquina encendida
  24 horas, y el teléfono no puede serlo.

Telegram no tiene ninguno de esos problemas:

| | WhatsApp | Telegram |
|---|---|---|
| API oficial | Verificación de empresa + tarjeta | **Gratis, sin verificación** |
| Servidor 24 h | Obligatorio | **No: publica desde el teléfono** |
| Riesgo de ban | Alto con librerías no oficiales | **Ninguno, es la API oficial** |
| Costo mensual | Por conversación | **Cero** |
| Para los compradores de la app | Cada uno su servidor | Cada uno crea su bot con @BotFather en dos minutos |

Esa última fila importa para vender la app: no hay infraestructura que mantener
ni cobrar aparte.

**Instagram** se descartó porque su API de publicación exige que la foto esté en
una **URL pública** — Instagram va a buscarla —, o sea que vuelve a hacer falta
un servidor. **Facebook** es posible pero pide una app de Meta con revisión
aprobada y tokens que caducan cada 60 días.

## Hallazgos técnicos, ya verificados contra el código

Esto está comprobado, no supuesto:

- **`CapacitorHttp` está disponible** en `@capacitor/core` 7.6.8
  (`node_modules/@capacitor/core/types/core-plugins.d.ts`). No hace falta añadir
  ninguna dependencia.
- Con `CapacitorHttp: { enabled: true }` en `capacitor.config.ts` se parchea
  `window.fetch` para que salga por la capa nativa: **sin CORS y con soporte de
  `FormData`/`Blob`**, que es justo lo que hace falta para subir fotos. Las fotos
  se guardan como data URL base64 (`Product.image`) y Telegram no acepta base64:
  hay que convertirlas a `Blob` y mandarlas como multipart.
- **La app no pide permiso de INTERNET.** El manifest lo dice por escrito: *«No
  network (INTERNET) permission is requested, so the app cannot reach the
  internet at all»*. Habría que añadir el permiso y reescribir ese comentario
  para que siga diciendo la verdad.
- **El token del bot se filtraría en las copias de seguridad.** `exportData()`
  en `src/lib/db.ts` incluye la tabla `settings` entera, y esa copia se comparte
  por WhatsApp: quien la reciba podría publicar en el canal. Hay que **excluir el
  token del JSON exportado** y pedirlo de nuevo al restaurar. El nombre del canal
  sí puede quedarse; no es secreto.

## Fase 0, con parada obligatoria

No se pudo verificar que `api.telegram.org` responda con datos de ETECSA.
Construir la pantalla de publicación antes de saberlo sería trabajo tirado, así
que esto va primero y **se entrega un APK para probar antes de seguir**:

1. `<uses-permission android:name="android.permission.INTERNET" />` en
   `android/app/src/main/AndroidManifest.xml`, y reescribir el comentario.
2. `CapacitorHttp: { enabled: true }` en `capacitor.config.ts`.
3. En Configuración → Datos: campo para el token, campo para el canal, y botón
   **«Probar conexión»** que llame a `getMe` y enseñe el resultado tal cual,
   incluido el error si lo hay.

**Si `getMe` no responde desde el teléfono, el resto no se construye** y se dice
claramente en vez de seguir gastando trabajo.

## El resto, si la Fase 0 sale bien

- **`src/lib/telegram.ts`** (nuevo): `getMe`, `sendPhoto`, `sendMessage`,
  `editMessageCaption`, `deleteMessage`, todo contra
  `https://api.telegram.org/bot<token>/`.
  Los errores de Telegram vienen **en el cuerpo** (`ok: false`, `description`),
  no como códigos HTTP raros: hay que leerlos y traducir los cuatro habituales —
  token inválido, el bot no es administrador del canal, canal inexistente, y
  demasiadas peticiones seguidas.
- **Pantalla de publicar** en `src/pages/Productos.tsx`, copiando el patrón que
  ya funciona en `ImportCustomers` (`src/pages/Clientes.tsx`): lista con casillas
  de los productos **con stock > 0**, buscador, botones Todos / Ninguno, y
  `FixedBottomBar` para la acción principal — que no vuelva a quedar al final de
  la lista.
- Reutilizar **`runWithProgress`** (`src/lib/progress.ts`) y **`ProgressOverlay`**:
  publicar varios es una operación larga por red y necesita cuenta y bloqueo,
  igual que el borrado en bloque.
- El nombre del producto sale de **`describeProduct`** (`src/lib/cost.ts`), que
  ya junta nombre y marca.
- **Tabla `publications`** en `TABLE_NAMES` (`src/lib/store.ts`), con
  `productId`, `messageId`, `chatId`, `publishedAt`, `status`, para saber qué se
  anunció y poder tocarlo después.
- **Cuando algo anunciado se queda sin stock**: aviso en Productos y dos botones
  — *Marcar AGOTADO* (edita el mensaje del canal) o *Borrar del canal*. Nunca
  automático.

### Decisiones ya tomadas

- Solo Telegram.
- Se elige a mano qué se publica y cuándo.
- Cuando algo se agota, la app avisa y el usuario decide qué hacer.

## Tasa de cambio

Va en la misma tanda, pero se decidió aparte y es más pequeño.

Hoy las tasas se escriben a mano en Configuración → Tasas, y de esos tres
números cuelgan todas las conversiones y todas las ganancias, incluido el costeo
por lotes. Si la tasa se mueve y no se actualiza, la ganancia que muestra la app
es falsa y nada avisa.

- Botón **«Buscar tasa de hoy»**, **solo cuando el usuario lo pida** — nunca
  sola, nunca a sus espaldas. Enseña lo que encontró al lado de lo guardado
  («USD: 425, tienes 320») y él acepta o no.
- Fuente: la tasa informal, con El Toque como referencia en Cuba. **El formato
  exacto se comprueba en la Fase 0**, no se da por bueno de antemano.
- Si falla, un aviso y nada más: los números a mano siguen igual que hoy.
- **`ratesReviewedAt` ya existe** (`src/contexts/AppContext.tsx:65`) y hoy solo
  sirve para tachar un paso de la lista de primeros pasos. Sirve para avisar en
  Inicio cuando lleve más de una semana sin revisarse. **Ese aviso funciona sin
  internet** y es la mitad del valor de todo esto.
- **No toca ninguna venta pasada**: cada venta congela su costo en CUP a
  propósito, para que la ganancia de ayer no cambie porque hoy subió el dólar.

## La regla que no se negocia

Nada de lo que funciona sin internet puede romperse. Vender, cobrar, inventario
y copias de seguridad siguen funcionando sin señal exactamente igual, y si
Telegram o la fuente de la tasa no responden, se avisa y se sigue.

Que la app funcione sin internet es hoy su mejor argumento de venta. Todo esto
es opcional y va encima, no en medio.
