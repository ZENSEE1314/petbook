import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, type SiteSettings } from "./api";

type Ctx = {
  settings: SiteSettings | null;
  refresh: () => Promise<void>;
};

const SiteContext = createContext<Ctx | null>(null);

const DEFAULTS: SiteSettings = {
  site_name: "Petbook",
  tagline: null,
  logo_url: null,
  favicon_url: null,
  meta_title: null,
  meta_description: null,
  theme_color: "#f97316",
};

function applyToDocument(s: SiteSettings) {
  document.title = s.meta_title || `${s.site_name} — social, guide & shop for pet owners`;

  let desc = document.querySelector('meta[name="description"]');
  if (!desc) {
    desc = document.createElement("meta");
    desc.setAttribute("name", "description");
    document.head.appendChild(desc);
  }
  desc.setAttribute(
    "content",
    s.meta_description ||
      `${s.site_name} is a social feed, detailed pet care guide, and trusted shop — all in one place.`,
  );

  let theme = document.querySelector('meta[name="theme-color"]');
  if (!theme) {
    theme = document.createElement("meta");
    theme.setAttribute("name", "theme-color");
    document.head.appendChild(theme);
  }
  theme.setAttribute("content", s.theme_color);

  if (s.favicon_url) {
    // Remove existing icon links and add the admin-supplied one.
    document.querySelectorAll('link[rel~="icon"]').forEach((el) => el.remove());
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = s.favicon_url;
    document.head.appendChild(link);
  }
}

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api.get<SiteSettings>("/site/settings");
      setSettings(s);
      applyToDocument(s);
    } catch {
      setSettings(DEFAULTS);
      applyToDocument(DEFAULTS);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <SiteContext.Provider value={{ settings, refresh }}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite must be used inside SiteProvider");
  return ctx;
}
