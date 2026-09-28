import { Moon, Sun } from "lucide-react";
import PublicNav from "../components/PublicNav";
import { useTheme } from "../context/useTheme";
import "./Settings.css";

export default function Settings({ adminMode = false }) {
  const { theme, toggleTheme } = useTheme();
  const content = <>
    <header className={adminMode ? "admin-page__header" : "user-page__header"}>
      <div>
        <p className={adminMode ? "admin-page__description" : "user-page__eyebrow"}>Preferences</p>
        <h1 className={adminMode ? "admin-page__title" : undefined}>Settings</h1>
        {!adminMode && <p>Choose how TrustHome appears on this device.</p>}
      </div>
    </header>
    <section className="settings-page__section" aria-labelledby="settings-appearance-title">
      <div className="settings-page__section-heading">
        <div>
          <h2 id="settings-appearance-title">Appearance</h2>
          <p>Theme preference is saved in this browser.</p>
        </div>
      </div>
      <div className="settings-page__theme" role="group" aria-label="Color theme">
        <button type="button" className={`settings-page__theme-option${theme === "light" ? " settings-page__theme-option--active" : ""}`} aria-pressed={theme === "light"} onClick={() => { if (theme !== "light") toggleTheme(); }}>
          <Sun size={18} aria-hidden="true" /> Light
        </button>
        <button type="button" className={`settings-page__theme-option${theme === "dark" ? " settings-page__theme-option--active" : ""}`} aria-pressed={theme === "dark"} onClick={() => { if (theme !== "dark") toggleTheme(); }}>
          <Moon size={18} aria-hidden="true" /> Dark
        </button>
      </div>
    </section>
  </>;

  if (adminMode) return <div className="admin-page settings-page">{content}</div>;
  return <div className="user-page"><PublicNav /><main className="user-page__content settings-page">{content}</main></div>;
}
