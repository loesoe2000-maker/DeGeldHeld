import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PrivacyPage from "../app/privacy/page";
import VoorwaardenPage from "../app/voorwaarden/page";
import OverOnsPage from "../app/over-ons/page";
import ContactPage from "../app/contact/page";
import Footer from "../components/Footer";
import CookieBanner from "../components/CookieBanner";

describe("trust pages render", () => {
  it("/privacy renders AVG content", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: /Privacy/i })).toBeTruthy();
    expect(screen.getAllByText(/AVG/i).length).toBeGreaterThan(0);
  });

  it("/voorwaarden renders algemene voorwaarden", () => {
    render(<VoorwaardenPage />);
    expect(screen.getByRole("heading", { level: 1, name: /Algemene voorwaarden/i })).toBeTruthy();
    expect(screen.getByText(/no-cure-no-pay/i)).toBeTruthy();
  });

  it("/over-ons renders the founder story", () => {
    render(<OverOnsPage />);
    expect(screen.getByRole("heading", { level: 1, name: /Over DeGeldHeld/i })).toBeTruthy();
    expect(screen.getByText(/Trim/i)).toBeTruthy();
  });

  it("/contact renders AVG-verzoek block", () => {
    render(<ContactPage />);
    expect(screen.getByRole("heading", { level: 1, name: /Contact/i })).toBeTruthy();
    expect(screen.getAllByText(/AVG-verzoek/i).length).toBeGreaterThan(0);
  });
});

describe("Footer trust links", () => {
  it("contains links to /privacy, /voorwaarden, /over-ons, /contact", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: /Privacy/i }).getAttribute("href")).toBe("/privacy");
    expect(screen.getByRole("link", { name: /Voorwaarden/i }).getAttribute("href")).toBe(
      "/voorwaarden",
    );
    expect(screen.getByRole("link", { name: /Over ons/i }).getAttribute("href")).toBe("/over-ons");
    expect(screen.getByRole("link", { name: /^Contact$/i }).getAttribute("href")).toBe("/contact");
  });
});

describe("CookieBanner", () => {
  // jsdom in this vitest setup ships without localStorage — polyfill a
  // simple in-memory Map so the banner can persist choices.
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => store.set(k, String(v)),
        removeItem: (k: string) => store.delete(k),
        clear: () => store.clear(),
        get length() { return store.size; },
        key: (i: number) => Array.from(store.keys())[i] ?? null,
      },
    });
    try { document.cookie = "dgh_consent=; path=/; max-age=0"; } catch { /* ignore */ }
    delete (window as unknown as { __dghDisableTracking?: boolean }).__dghDisableTracking;
  });

  it("shows on first visit", async () => {
    render(<CookieBanner />);
    expect(await screen.findByRole("region", { name: /Cookie/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Akkoord/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /functioneel/i })).toBeTruthy();
  });

  it("clicking Akkoord stores 'all' in localStorage and hides", async () => {
    render(<CookieBanner />);
    const btn = await screen.findByRole("button", { name: /Akkoord/i });
    fireEvent.click(btn);
    expect(window.localStorage.getItem("dgh_consent")).toBe("all");
    expect(screen.queryByRole("region", { name: /Cookie/i })).toBeNull();
  });

  it("clicking 'Alleen functioneel' stores 'functional' + sets tracking flag", async () => {
    render(<CookieBanner />);
    const btn = await screen.findByRole("button", { name: /functioneel/i });
    fireEvent.click(btn);
    expect(window.localStorage.getItem("dgh_consent")).toBe("functional");
    expect(
      (window as unknown as { __dghDisableTracking?: boolean }).__dghDisableTracking,
    ).toBe(true);
  });

  it("does not render once a choice already exists", () => {
    window.localStorage.setItem("dgh_consent", "all");
    render(<CookieBanner />);
    expect(screen.queryByRole("region", { name: /Cookie/i })).toBeNull();
  });
});
