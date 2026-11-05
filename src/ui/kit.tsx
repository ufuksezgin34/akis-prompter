import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/** Logo işareti: üç satırlı ekran + ayak (prompter). */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="logo-mark">
      <rect x="4" y="5" width="32" height="22" rx="5" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M11 12h18M11 17h18M11 22h11" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M20 27v5M14 37l6-5 6 5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export const APP_NAME = 'Teleprompter';

export function Brand({ center }: { center?: boolean }) {
  return (
    <div className={`brand-bar${center ? ' center' : ''}`}>
      <LogoMark />
      <span>{APP_NAME}</span>
    </div>
  );
}

export function PageHead({ title, subtitle, onBack, action }: { title: string; subtitle?: string; onBack?: () => void; action?: ReactNode }) {
  return (
    <header className="page-head">
      {onBack && (
        <button className="back-btn" onClick={onBack} aria-label="Geri">
          <Icon name="prevSentence" size={26} />
        </button>
      )}
      <div className="page-head-row">
        <h1>{title}</h1>
        {action}
      </div>
      {subtitle && <p className="subtitle">{subtitle}</p>}
    </header>
  );
}

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="group">
      {title && <h2 className="group-title">{title}</h2>}
      <div className="group-card">{children}</div>
    </section>
  );
}

export function Row({
  icon,
  label,
  value,
  onClick,
  children,
  hint,
}: {
  icon: IconName;
  label: string;
  value?: ReactNode;
  onClick?: () => void;
  children?: ReactNode;
  hint?: string;
}) {
  const body = (
    <>
      <span className="row-icon"><Icon name={icon} /></span>
      <span className="row-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {value !== undefined && <span className="row-value">{value}</span>}
      {children}
      {onClick && <span className="row-chev"><Icon name="nextSentence" size={20} /></span>}
    </>
  );
  return onClick ? (
    <button className="list-row" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="list-row">{body}</div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

export function ActionCard({ icon, title, text, onClick }: { icon: IconName; title: string; text: string; onClick: () => void }) {
  return (
    <button className="action-card" onClick={onClick}>
      <span className="action-icon"><Icon name={icon} size={30} /></span>
      <span className="action-text">
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
      <Icon name="nextSentence" size={22} />
    </button>
  );
}
