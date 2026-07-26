import { useState } from 'react';
import {
  ShoppingCart,
  Package,
  Users,
  Handshake,
  BarChart3,
  ShieldCheck,
  Store,
  type LucideIcon,
} from 'lucide-react';
import { useBackHandler } from '@/lib/backHandler';

interface TourStep {
  icon: LucideIcon;
  title: string;
  body: string;
}

/**
 * First-run walkthrough. Deliberately plain cards rather than spotlights on the
 * real UI: it has to survive every screen size without ever covering the thing
 * it is pointing at.
 */
const STEPS: TourStep[] = [
  {
    icon: Store,
    title: 'Bienvenida',
    body: 'Esta app lleva la cuenta de tu negocio: lo que vendes, lo que te deben y lo que debes tú. Todo se guarda en este teléfono y funciona sin internet.',
  },
  {
    icon: Package,
    title: 'Productos',
    body: 'Aquí entras la mercancía. Marca cada artículo como Propio si es tuyo, o Ajeno si alguien te lo dejó para vendérselo. Esa diferencia es la que manda en todas las cuentas.',
  },
  {
    icon: ShoppingCart,
    title: 'Vender',
    body: 'Tocas los productos para armar el carrito y eliges si te pagan en efectivo, por transferencia o a plazos. El inventario se descuenta solo.',
  },
  {
    icon: Users,
    title: 'Clientes',
    body: 'Los que te compran a plazos quedan aquí, con lo que deben y cuándo les toca pagar. Los atrasados salen en rojo y les puedes mandar un recordatorio por WhatsApp.',
  },
  {
    icon: Handshake,
    title: 'Dueños',
    body: 'Lo más importante si vendes cosas ajenas: el dueño pone el precio que quiere recibir y tú te quedas con lo que pase de ahí. La app te dice cuánto le debes a cada uno.',
  },
  {
    icon: BarChart3,
    title: 'Análisis',
    body: 'Cómo va el negocio por día, semana, mes o año, y qué es lo que más se vende.',
  },
  {
    icon: ShieldCheck,
    title: 'Antes de empezar',
    body: 'Hazte una copia de seguridad de vez en cuando desde Configuración: los datos viven solo en este teléfono. Y si algo se te olvida, el botón “?” de arriba te explica la pantalla en la que estés.',
  },
];

export default function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  useBackHandler(() => {
    if (step > 0) setStep((s) => s - 1);
    else onFinish();
  });

  return (
    <div className="fixed inset-0 z-[500] bg-gradient-to-b from-[#0F766E] to-[#134E4A] text-white flex flex-col">
      <div className="flex justify-end p-4 flex-shrink-0">
        {!isLast && (
          <button onClick={onFinish} className="text-sm text-white/70 px-3 py-2 active:opacity-60">
            Saltar
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-20 h-20 rounded-3xl bg-white/15 flex items-center justify-center mb-6">
          <Icon size={38} />
        </div>
        <h2 className="text-2xl font-bold">{current.title}</h2>
        <p className="text-[15px] text-white/80 mt-3 leading-relaxed max-w-sm">{current.body}</p>
      </div>

      <div className="flex-shrink-0 px-8 pb-10 space-y-5">
        <div className="flex justify-center gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-white' : 'w-1.5 bg-white/35'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 h-12 rounded-xl border border-white/40 font-medium active:scale-[0.98] transition-transform"
            >
              Atrás
            </button>
          )}
          <button
            onClick={() => (isLast ? onFinish() : setStep((s) => s + 1))}
            className="flex-1 h-12 rounded-xl bg-white text-[#0F766E] font-semibold active:scale-[0.98] transition-transform"
          >
            {isLast ? 'Empezar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
