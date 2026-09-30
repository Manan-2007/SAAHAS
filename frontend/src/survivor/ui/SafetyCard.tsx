import React from 'react';
import { Phone } from 'lucide-react';
import { useSurvivor } from '../SurvivorContext';
import { accentStyle } from './accents';

/**
 * Shown when someone mentions threats, pressure to withdraw the case or
 * ongoing harassment (safety: true). It is not the self-harm banner: it points
 * to protection, and says the counsellor already knows - the backend raised
 * an alert as the message arrived.
 */
export const SafetyCard: React.FC<{ onDismiss?: () => void }> = ({ onDismiss }) => {
  const { counsellor } = useSurvivor();
  return (
    <section
      role="alert"
      style={accentStyle('coral')}
      className="soft-fade rounded-card bg-raised border border-line border-l-4 border-l-(--accent) p-4 flex flex-col gap-3"
    >
      <div>
        <p className="text-[17px] font-semibold text-ink">Your safety comes first.</p>
        <p className="mt-1 text-[15px] text-ink-2 break-soft">
          If you or your family are in danger now, call 112. Threats or pressure to take back a case can be reported to
          the National Helpline Against Atrocities, 14566 - free, any time. You have a legal right to protection.
        </p>
        <p className="mt-2 text-[15px] text-ink break-soft">
          {counsellor?.name ? `${counsellor.name} has been told, so they can help.` : 'Your counsellor has been told, so they can help.'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a href="tel:112" className="tactile min-h-12 rounded-tile bg-(--accent) text-on-accent font-bold inline-flex items-center justify-center gap-2">
          <Phone className="w-4 h-4" aria-hidden /> 112
        </a>
        <a href="tel:14566" className="tactile min-h-12 rounded-tile bg-ink text-canvas font-bold inline-flex items-center justify-center gap-2">
          <Phone className="w-4 h-4" aria-hidden /> 14566
        </a>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="self-center min-h-11 px-3 text-sm text-ink-2 hover:text-ink hover:underline underline-offset-4">
          Hide this for now
        </button>
      )}
    </section>
  );
};
