# Guía para vender la aplicación

Escrita para seguirla paso a paso, sin saber programación.

---

## Lo que tienes que tener guardado

Tres cosas. Guárdalas en tu computadora **y** en un correo a ti mismo, porque
si pierdes alguna hay problemas:

| Qué | Para qué sirve | Si lo pierdes |
|---|---|---|
| **El APK** | es lo que le instalas al cliente | se puede volver a compilar |
| **Tu secreto** | genera las licencias | **las licencias vendidas dejan de poder generarse de nuevo** |
| **generador-licencias.html** | convierte códigos en licencias | se puede volver a crear |

El secreto es lo único verdaderamente irreemplazable. Es un texto largo de
letras y números, con esta pinta: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx=`.
El tuyo no aparece escrito en ningún archivo de este repositorio, a propósito.

**Nunca le des el secreto ni el generador a un cliente.** Con eso, cualquiera
se fabrica sus propias licencias.

---

## Antes de la primera venta: prepara tu herramienta

1. Copia `generador-licencias.html` a tu teléfono o computadora.
2. Ábrelo (se abre con el navegador, como una página normal).
3. Pega tu secreto en el primer campo y toca **Recordar**.

Ya está. No necesita internet ni instalar nada. La próxima vez que lo abras,
el secreto sigue ahí.

---

## Vender a un cliente: los 6 pasos

### 1. Pásale el APK

Por WhatsApp, Telegram, memoria USB o Bluetooth. Es un archivo de unos 27 MB.

### 2. Que lo instale

En el teléfono del cliente:

- Toca el archivo `.apk` descargado
- Android dirá que **no permite instalar apps de origen desconocido**
- Toca **Configuración** en ese mismo aviso y activa el permiso
- Vuelve atrás y toca **Instalar**

La primera vez la app pide crear un **PIN de 4 dígitos**. Es suyo, para que
nadie más le vea las cuentas.

### 3. Déjala probar 15 días

La app funciona completa durante 15 días. Ese es tu mejor argumento de venta:
que la use con sus cosas de verdad antes de pagar.

Aprovecha ese rato para lo que de verdad estás cobrando: siéntate con ella,
métele sus productos y sus dueños del cuaderno, y enséñale a usarla.

### 4. Cuando decida pagar, pídele su código

Ella entra en **Configuración** (la rueda dentada arriba) → pestaña **Datos**,
y ahí ve:

```
Código de este teléfono
2Z358-WBZA2
```

Que te lo mande por WhatsApp, o dícteselo por teléfono. Los códigos no llevan
letras que se confundan al hablar: no hay I, ni L, ni O, ni U.

### 5. Genera la licencia

Abre `generador-licencias.html`, escribe el código del cliente, pon su nombre
para tu registro y toca **Generar licencia**:

```
Licencia para este teléfono
AYWR-1CPR-NEFE-3D68
```

Toca **Copiar** y mándasela.

La herramienta va guardando sola a quién le vendiste qué. Con **Exportar
registro** sacas la lista completa.

### 6. Que la active

Ella vuelve a **Configuración → Datos**, escribe la licencia y toca
**Activar licencia**. Aparece **Activada** en verde y listo.

No vence, no hay que renovarla, y no hace falta internet en ningún momento.

---

## Preguntas que te van a hacer

**«¿Y si cambio de teléfono?»**
Que haga una copia de seguridad antes (Configuración → Datos → Crear y
compartir copia) y la restaure en el teléfono nuevo. La licencia va dentro de
la copia, así que se activa sola. Sin copia, hace falta una licencia nueva.

**«Se me acabaron los 15 días y no he pagado todavía.»**
No pierde nada. Los datos siguen ahí esperando, y desde la misma pantalla de
bloqueo puede hacerse una copia de seguridad. En cuanto active, sigue donde
lo dejó.

**«¿Le puedo pasar la app a una amiga?»**
El APK sí, y ella tendrá sus 15 días de prueba. Pero la licencia no: solo abre
el teléfono para el que se hizo. Su amiga tendrá que comprarte la suya.

**«¿Necesito internet?»**
Nunca. Ni para usarla, ni para activarla, ni para las copias de seguridad.

---

## Cuando quieras sacar una versión nueva

El APK hay que compilarlo **con el mismo secreto de siempre**. Si se compila
con otro, las licencias que ya vendiste dejan de funcionar en la versión nueva.

Si me pides una compilación nueva, pásame el secreto y yo me encargo. Guarda
también este dato por si algún día lo hace otra persona:

```bash
cp .env.example .env      # y pon dentro tu secreto
npm run cap:sync
cd android && ./gradlew assembleDebug
```

Hay otra cosa que **no debe cambiar nunca**: el archivo
`android/app/debug.keystore` del repositorio. Es la firma de la app. Si se
compilara sin él, Android se negaría a instalar la actualización encima de la
que el cliente ya tiene, y para resolverlo habría que desinstalar, lo que borra
toda su contabilidad.

---

## Lo que esto protege y lo que no

Impide que un cliente reparta la app *ya activada* y le funcione a otros. Ese
es el caso real: la amiga a la que le pasan el APK por WhatsApp.

No impide que alguien con conocimientos abra el APK y le quite la comprobación.
Ninguna protección que viva dentro del teléfono lo consigue, así que no gastes
dinero ni tiempo buscando una que sí.

Por eso lo que de verdad se cobra no es el archivo: es instalársela, pasarle el
cuaderno a la app, enseñarle a usarla y estar ahí cuando algo falle. Eso no se
copia por WhatsApp.
