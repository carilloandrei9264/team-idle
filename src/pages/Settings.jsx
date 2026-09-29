import { Monitor, Moon, Sun } from "lucide-react";
import PublicNav from "../components/PublicNav";
import { useTheme } from "../context/useTheme";
import "./Settings.css";

const THEME_OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const ACCESSIBILITY_OPTIONS = [
  { key: "largeText", label: "Larger text", description: "Increase the size of interface text." },
  { key: "highContrast", label: "High contrast", description: "Strengthen text and surface contrast." },
  { key: "reduceMotion", label: "Reduce motion", description: "Limit animations and transitions." },
];

export default function Settings({ adminMode = false }) {
  const { themePreference, setThemePreference, accessibility, setAccessibility } = useTheme();
  const content = <>
    <header className={adminMode ? "admin-page__header" : "user-page__header"}>
      <div>
        <p className={adminMode ? "admin-page__description" : "user-page__eyebrow"}>Preferences</p>
        <h1 className={adminMode ? "admin-page__title" : undefined}>Settings</h1>
        {!adminMode && <p>Personalize how TrustHome looks and feels on this device.</p>}
      </div>
    </header>
    <section className="settings-page__section" aria-labelledby="settings-appearance-title">
      <div className="settings-page__section-heading">
        <div>
          <h2 id="settings-appearance-title">Appearance</h2>
          <p>Choose a theme or follow your device setting.</p>
        </div>
      </div>
      <div className="settings-page__theme" role="group" aria-label="Color theme">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            className={`settings-page__theme-option${themePreference === value ? " settings-page__theme-option--active" : ""}`}
            aria-pressed={themePreference === value}
            onClick={() => setThemePreference(value)}
          >
            <Icon size={18} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
    </section>
    <section className="settings-page__section" aria-labelledby="settings-accessibility-title">
      <div className="settings-page__section-heading">
        <div>
          <h2 id="settings-accessibility-title">Accessibility</h2>
          <p>Adjust display and motion preferences. Changes are saved on this device.</p>
        </div>
      </div>
      <div className="settings-page__options">
        {ACCESSIBILITY_OPTIONS.map(({ key, label, description }) => (
          <label className="settings-page__toggle" key={key}>
            <span className="settings-page__toggle-copy">
              <strong>{label}</strong>
              <span>{description}</span>
            </span>
            <input
              type="checkbox"
              checked={accessibility[key]}
              onChange={(event) => setAccessibility((current) => ({ ...current, [key]: event.target.checked }))}
            />
          </label>
        ))}
      </div>
    </section>
  </>;

  if (adminMode) return <div className="admin-page settings-page">{content}</div>;
  return <div className="user-page"><PublicNav /><main className="user-page__content settings-page">{content}</main></div>;
}
