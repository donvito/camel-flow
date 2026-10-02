import { useEffect, useRef, type CSSProperties } from 'react';
import { Check, Monitor, Palette } from 'lucide-react';
import { useSettings } from '../settings';
import { THEMES, type ThemeId } from '../themes';
import { Popover } from './Popover';

function ThemeOptions() {
  const { theme, setTheme } = useSettings();
  const fieldset = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    fieldset.current?.querySelector<HTMLInputElement>('input:checked')?.focus();
  }, []);

  return (
    <fieldset className="theme-picker" ref={fieldset}>
      <legend>Appearance</legend>
      <p className="theme-intro">A fresh perspective on your flow.</p>
      <label className="theme-system">
        <input type="radio" name="theme" value="system" aria-label="System" checked={theme === 'system'} onChange={() => setTheme('system')} />
        <Monitor size={18} aria-hidden />
        <span><strong>System</strong><span className="muted small">Follow your device</span></span>
        <Check className="theme-check" size={16} aria-hidden />
      </label>
      <div className="theme-grid">
        {(Object.keys(THEMES) as ThemeId[]).map((id) => {
          const t = THEMES[id];
          return (
            <label key={id} className="theme-option" style={{ '--preview-bg': t.canvas, '--preview-panel': t.panel, '--preview-accent': t.accent } as CSSProperties}>
              <input type="radio" name="theme" value={id} aria-label={t.name} aria-describedby={`theme-description-${id}`} checked={theme === id} onChange={() => setTheme(id)} />
              <span className="theme-preview" aria-hidden>
                <span className="theme-preview-bar"><i /><i /><i /></span>
                <span className="theme-preview-flow"><i /><span /><i /><span /><i /></span>
                <Check className="theme-check" size={14} />
              </span>
              <span className="theme-option-name">{t.name}</span>
              <span className="theme-option-description" id={`theme-description-${id}`}>{t.description}</span>
            </label>
          );
        })}
      </div>
      <p className="theme-footer">Saved automatically · <kbd>T</kbd> to cycle</p>
    </fieldset>
  );
}

export function ThemePicker() {
  const { resolvedTheme } = useSettings();
  return (
    <Popover label="Choose theme" title={`Theme: ${THEMES[resolvedTheme].name} (T)`} button={<><Palette size={16} /><span className="theme-indicator" style={{ background: THEMES[resolvedTheme].accent }} /></>}>
      <ThemeOptions />
    </Popover>
  );
}
