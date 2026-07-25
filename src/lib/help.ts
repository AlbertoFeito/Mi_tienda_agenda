/**
 * In-app help content.
 *
 * Written for the person running the store, not for a developer: every topic
 * answers "how do I do this" or "why does the app show this number", in plain
 * Spanish. Topics tied to a route are what the "?" button opens on that
 * screen; the rest are general and only show up in the index and the search.
 */

export interface HelpTopic {
  id: string;
  /** Route this topic is the contextual help for, when it has one. */
  route?: string;
  title: string;
  summary: string;
  steps?: string[];
  notes?: string[];
  keywords: string[];
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'inicio',
    route: '/',
    title: 'Inicio',
    summary:
      'El resumen del día: lo que vendiste hoy, lo que ganaste, los productos que se están acabando y los cobros que tienes cerca.',
    notes: [
      'Las ganancias que ves aquí ya tienen descontado lo que les debes a los dueños de los artículos ajenos.',
      'Si un producto aparece en rojo es que se quedó sin existencias; en naranja, que le queda poco.',
    ],
    keywords: ['inicio', 'resumen', 'dashboard', 'hoy', 'principal'],
  },
  {
    id: 'vender',
    route: '/ventas',
    title: 'Hacer una venta',
    summary: 'Arma el carrito con lo que se lleva el cliente y elige cómo te paga.',
    steps: [
      'Busca el producto y tócalo para añadirlo al carrito.',
      'Ajusta la cantidad con los botones + y −.',
      'Si le haces rebaja, escríbela en “Descuento”.',
      'Elige la forma de pago: Efectivo, Transferencia o A plazos.',
      'Si es a plazos, escoge el cliente, cuántos pagos y cada cuánto le toca pagar.',
      'Toca “Cobrar” para cerrar la venta.',
    ],
    notes: [
      'Al terminar puedes mandarle el recibo al cliente por WhatsApp o SMS.',
      'El inventario se descuenta solo: no hace falta que toques el stock a mano.',
    ],
    keywords: ['vender', 'venta', 'cobrar', 'carrito', 'recibo', 'descuento', 'efectivo', 'transferencia'],
  },
  {
    id: 'productos',
    route: '/productos',
    title: 'Productos: propios y ajenos',
    summary:
      'Un producto es Propio cuando la mercancía es tuya, y Ajeno cuando alguien te la dejó para que se la vendas.',
    steps: [
      'Toca el botón + para crear un producto.',
      'Elige arriba si es Propio o Ajeno.',
      'Pon el Precio de Costo: lo que te costó a ti, o lo que el dueño quiere recibir.',
      'Pon el Precio de Venta: en cuánto lo vas a dar.',
      'Si es Ajeno, elige el dueño de la lista.',
      'Guarda.',
    ],
    notes: [
      'La app te enseña la ganancia por unidad mientras escribes los precios.',
      'En los ajenos hay una calculadora: pones el % que quieres ganar y te sugiere el precio de venta.',
      'El Stock Mínimo es el número a partir del cual te avisa que se está acabando.',
    ],
    keywords: ['productos', 'propio', 'ajeno', 'stock', 'inventario', 'precio', 'costo', 'foto', 'categoría'],
  },
  {
    id: 'clientes',
    route: '/clientes',
    title: 'Clientes y cobros a plazos',
    summary: 'Aquí llevas quién te debe, cuánto, y cuándo le toca pagar.',
    steps: [
      'Toca + para añadir un cliente, o elígelo de los contactos del teléfono.',
      'Toca un cliente para ver lo que debe y su historial.',
      'Cuando te pague, toca “Registrar pago” y pon el monto.',
    ],
    notes: [
      'Los que están atrasados salen marcados en rojo.',
      'Desde la ficha del cliente puedes mandarle un recordatorio por WhatsApp o SMS, ya escrito.',
      'Al crear un cliente nuevo puedes guardarlo también en la agenda del teléfono.',
    ],
    keywords: ['clientes', 'deuda', 'plazos', 'cobro', 'pago', 'recordatorio', 'atrasado', 'contactos'],
  },
  {
    id: 'duenos',
    route: '/duenos',
    title: 'Dueños: cuánto le debes a cada uno',
    summary:
      'Cuando alguien te deja mercancía para vender, él pone el precio que quiere recibir y tú te quedas con todo lo que pase de ahí.',
    steps: [
      'El dueño te dice cuánto quiere por su artículo: eso es el Precio de Costo.',
      'Tú lo vendes más caro: la diferencia es tu ganancia.',
      'Cada vez que se vende una unidad, la app suma a lo que le debes.',
      'Cuando le pagues, entra en su ficha y toca “Registrar pago al dueño”.',
    ],
    notes: [
      'Ejemplo: el dueño quiere 100 por una blusa y tú la vendes en 150. Si vendes 2, le debes 200 y tú ganaste 100.',
      'El “Saldo a pagar” es lo vendido menos lo que ya le entregaste.',
      'Puedes mandarle el resumen de su cuenta por WhatsApp o SMS desde su ficha.',
      'En “Gestionar” creas los dueños, con su teléfono, y los eliges de tus contactos.',
    ],
    keywords: ['dueños', 'ajeno', 'liquidación', 'consignación', 'deber', 'saldo', 'pagar', 'entregar'],
  },
  {
    id: 'analisis',
    route: '/analisis',
    title: 'Análisis',
    summary: 'Cómo va el negocio por día, semana, mes o año: lo vendido, lo ganado y lo que más sale.',
    notes: [
      'Puedes cambiar el período arriba.',
      'La ganancia es lo que te quedó a ti, ya descontado el costo y lo de los dueños.',
      'Los productos más vendidos te dicen qué te conviene reponer.',
    ],
    keywords: ['análisis', 'ganancia', 'reporte', 'estadística', 'período', 'más vendido'],
  },
  {
    id: 'monedas',
    title: 'Monedas y tasas de cambio',
    summary:
      'Puedes cobrar en CUP, USD, EUR o MLC, pero las cuentas finales se hacen siempre en CUP para que todo se pueda comparar.',
    steps: [
      'Entra en Configuración (el engranaje de arriba).',
      'En la pestaña “Tasas”, pon cuántos CUP vale cada moneda.',
      'Guarda.',
    ],
    notes: [
      'Actualiza las tasas cuando cambien, porque las ganancias se calculan con ellas.',
      'Una venta guardada no cambia de valor después: se queda con la tasa del día en que la hiciste.',
    ],
    keywords: ['moneda', 'tasa', 'cambio', 'usd', 'euro', 'mlc', 'cup', 'dólar'],
  },
  {
    id: 'copia',
    title: 'Copia de seguridad',
    summary:
      'Todos los datos viven en este teléfono. Si lo pierdes o lo formateas, sin copia no hay manera de recuperarlos.',
    steps: [
      'Entra en Configuración → pestaña “Datos”.',
      'Toca “Crear y compartir copia”.',
      'Mándate el archivo a ti misma por WhatsApp o correo, o guárdalo en otro lugar.',
    ],
    notes: [
      'La app hace una copia sola una vez al día, pero esa también se pierde si se pierde el teléfono.',
      'Para restaurar: “Restaurar copia” y busca el archivo. Ojo, eso reemplaza todo lo que tengas ahora.',
      'Hazte una copia cada cierto tiempo, sobre todo antes de cambiar de teléfono.',
    ],
    keywords: ['copia', 'seguridad', 'respaldo', 'backup', 'restaurar', 'perder', 'datos'],
  },
  {
    id: 'seguridad',
    title: 'PIN y huella',
    summary: 'La app se abre con un PIN de 4 dígitos, y puedes activar la huella para entrar más rápido.',
    steps: [
      'Configuración → pestaña “Datos”.',
      '“Cambiar PIN” para poner otro.',
      '“Desbloqueo por huella” para activarla o quitarla.',
    ],
    notes: ['Si activas la huella, el PIN sigue funcionando por si el lector falla.'],
    keywords: ['pin', 'huella', 'clave', 'contraseña', 'seguridad', 'bloqueo', 'desbloquear'],
  },
];

/** The contextual topic for a screen, when that screen has one. */
export function topicForRoute(route: string): HelpTopic | undefined {
  return HELP_TOPICS.find((t) => t.route === route);
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Search titles, text and keywords, ignoring accents and capitals. */
export function searchTopics(query: string): HelpTopic[] {
  const q = fold(query.trim());
  if (!q) return HELP_TOPICS;
  return HELP_TOPICS.filter((t) => {
    const haystack = fold(
      [t.title, t.summary, ...(t.steps ?? []), ...(t.notes ?? []), ...t.keywords].join(' '),
    );
    return haystack.includes(q);
  });
}

/** The whole help as plain text, for sharing it out of the app. */
export function buildHelpManual(storeName: string): string {
  const lines: string[] = [`Manual de ${storeName}`, ''];
  for (const topic of HELP_TOPICS) {
    lines.push(topic.title.toUpperCase());
    lines.push(topic.summary);
    if (topic.steps?.length) {
      lines.push('');
      topic.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }
    if (topic.notes?.length) {
      lines.push('');
      for (const n of topic.notes) lines.push(`• ${n}`);
    }
    lines.push('');
    lines.push('—');
    lines.push('');
  }
  return lines.join('\n').trim();
}
