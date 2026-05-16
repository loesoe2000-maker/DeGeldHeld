/**
 * Minimal i18n — 40 keys for hero/CTA/dashboard/error messages.
 * Locale is resolved server-side from cookie `dgh_locale` or Accept-Language.
 *
 * Provider locale (from lib/providers.ts) drives email language; UI locale
 * drives interface chrome (hero, buttons, labels). These can differ — a Dutch
 * UI user may have a German provider, mail goes out in DE while the page
 * stays NL.
 */

import { cookies, headers } from "next/headers";

export type Locale = "nl" | "en" | "de" | "fr";
export const SUPPORTED_LOCALES: Locale[] = ["nl", "en", "de", "fr"];
export const DEFAULT_LOCALE: Locale = "nl";
export const LOCALE_COOKIE = "dgh_locale";

export type DictKey =
  // hero / landing
  | "hero_title"
  | "hero_subtitle"
  | "hero_cta"
  | "hero_secondary_cta"
  | "fee_disclaimer"
  // navigation
  | "nav_dashboard"
  | "nav_proof"
  | "nav_faq"
  | "nav_login"
  | "nav_logout"
  | "nav_settings"
  // dashboard
  | "dashboard_title"
  | "dashboard_total_saved"
  | "dashboard_open_negotiations"
  | "dashboard_completed"
  | "dashboard_failed"
  | "dashboard_new_bill_cta"
  | "dashboard_empty_state"
  // negotiation flow
  | "upload_title"
  | "upload_drop_here"
  | "upload_too_large"
  | "analyse_title"
  | "email_title"
  | "email_copy"
  | "email_copied"
  | "email_share_whatsapp"
  // outcome
  | "outcome_question"
  | "outcome_success"
  | "outcome_waiting"
  | "outcome_failed"
  | "outcome_thanks"
  // proof
  | "proof_title"
  | "proof_total_saved"
  | "proof_basis_actual"
  | "proof_basis_expected"
  // errors
  | "error_generic"
  | "error_network"
  | "error_unauthorized"
  | "error_not_found"
  | "error_rate_limited";

type Dict = Record<DictKey, string>;

const NL: Dict = {
  hero_title: "Bespaar op je vaste lasten",
  hero_subtitle: "Wij onderhandelen met je provider voor jou. Jij betaalt 15% van wat we besparen.",
  hero_cta: "Upload je rekening",
  hero_secondary_cta: "Bekijk track record",
  fee_disclaimer: "Geen besparing = geen kosten",
  nav_dashboard: "Dashboard",
  nav_proof: "Track record",
  nav_faq: "Veelgestelde vragen",
  nav_login: "Inloggen",
  nav_logout: "Uitloggen",
  nav_settings: "Instellingen",
  dashboard_title: "Mijn onderhandelingen",
  dashboard_total_saved: "Totaal bespaard",
  dashboard_open_negotiations: "Lopende onderhandelingen",
  dashboard_completed: "Voltooid",
  dashboard_failed: "Gefaald",
  dashboard_new_bill_cta: "Nieuwe factuur uploaden",
  dashboard_empty_state: "Nog geen onderhandelingen — upload je eerste rekening om te starten.",
  upload_title: "Upload je factuur",
  upload_drop_here: "Sleep hier je factuur of klik om te kiezen",
  upload_too_large: "Bestand groter dan 10 MB",
  analyse_title: "Analyse",
  email_title: "Onderhandel-email",
  email_copy: "Kopieer onderwerp + bericht",
  email_copied: "Gekopieerd ✓",
  email_share_whatsapp: "Deel via WhatsApp",
  outcome_question: "Hoe ging de onderhandeling?",
  outcome_success: "Geslaagd",
  outcome_waiting: "Nog wachten",
  outcome_failed: "Geweigerd",
  outcome_thanks: "Dank je! Je bijdrage staat nu in onze Track Record.",
  proof_title: "Track record",
  proof_total_saved: "Totaal bespaard",
  proof_basis_actual: "Behaald",
  proof_basis_expected: "Verwacht",
  error_generic: "Er ging iets mis — probeer opnieuw",
  error_network: "Netwerkfout — probeer opnieuw",
  error_unauthorized: "Je moet inloggen om dit te doen",
  error_not_found: "Pagina niet gevonden",
  error_rate_limited: "Te veel verzoeken — probeer over een minuut opnieuw",
};

const EN: Dict = {
  hero_title: "Save on your monthly bills",
  hero_subtitle: "We negotiate with your provider for you. You pay 15% of what we save.",
  hero_cta: "Upload your bill",
  hero_secondary_cta: "View track record",
  fee_disclaimer: "No savings = no fee",
  nav_dashboard: "Dashboard",
  nav_proof: "Track record",
  nav_faq: "FAQ",
  nav_login: "Log in",
  nav_logout: "Log out",
  nav_settings: "Settings",
  dashboard_title: "My negotiations",
  dashboard_total_saved: "Total saved",
  dashboard_open_negotiations: "Open negotiations",
  dashboard_completed: "Completed",
  dashboard_failed: "Failed",
  dashboard_new_bill_cta: "Upload new bill",
  dashboard_empty_state: "No negotiations yet — upload your first bill to start.",
  upload_title: "Upload your invoice",
  upload_drop_here: "Drop your invoice here or click to choose",
  upload_too_large: "File larger than 10 MB",
  analyse_title: "Analysis",
  email_title: "Negotiation email",
  email_copy: "Copy subject + body",
  email_copied: "Copied ✓",
  email_share_whatsapp: "Share via WhatsApp",
  outcome_question: "How did the negotiation go?",
  outcome_success: "Successful",
  outcome_waiting: "Still waiting",
  outcome_failed: "Rejected",
  outcome_thanks: "Thanks! Your contribution is now in our Track Record.",
  proof_title: "Track record",
  proof_total_saved: "Total saved",
  proof_basis_actual: "Actual",
  proof_basis_expected: "Expected",
  error_generic: "Something went wrong — please retry",
  error_network: "Network error — please retry",
  error_unauthorized: "You must be logged in to do this",
  error_not_found: "Page not found",
  error_rate_limited: "Too many requests — try again in a minute",
};

const DE: Dict = {
  hero_title: "Sparen Sie bei Ihren Fixkosten",
  hero_subtitle: "Wir verhandeln mit Ihrem Anbieter für Sie. Sie zahlen 15% der Ersparnis.",
  hero_cta: "Rechnung hochladen",
  hero_secondary_cta: "Track Record ansehen",
  fee_disclaimer: "Keine Ersparnis = keine Gebühr",
  nav_dashboard: "Dashboard",
  nav_proof: "Track Record",
  nav_faq: "FAQ",
  nav_login: "Anmelden",
  nav_logout: "Abmelden",
  nav_settings: "Einstellungen",
  dashboard_title: "Meine Verhandlungen",
  dashboard_total_saved: "Insgesamt gespart",
  dashboard_open_negotiations: "Laufende Verhandlungen",
  dashboard_completed: "Abgeschlossen",
  dashboard_failed: "Fehlgeschlagen",
  dashboard_new_bill_cta: "Neue Rechnung hochladen",
  dashboard_empty_state: "Noch keine Verhandlungen — laden Sie Ihre erste Rechnung hoch.",
  upload_title: "Rechnung hochladen",
  upload_drop_here: "Rechnung hierher ziehen oder klicken zum Auswählen",
  upload_too_large: "Datei größer als 10 MB",
  analyse_title: "Analyse",
  email_title: "Verhandlungsmail",
  email_copy: "Betreff + Text kopieren",
  email_copied: "Kopiert ✓",
  email_share_whatsapp: "Per WhatsApp teilen",
  outcome_question: "Wie lief die Verhandlung?",
  outcome_success: "Erfolgreich",
  outcome_waiting: "Noch warten",
  outcome_failed: "Abgelehnt",
  outcome_thanks: "Danke! Ihr Beitrag ist nun in unserem Track Record.",
  proof_title: "Track Record",
  proof_total_saved: "Insgesamt gespart",
  proof_basis_actual: "Erzielt",
  proof_basis_expected: "Erwartet",
  error_generic: "Etwas ist schiefgelaufen — bitte erneut versuchen",
  error_network: "Netzwerkfehler — bitte erneut versuchen",
  error_unauthorized: "Sie müssen angemeldet sein",
  error_not_found: "Seite nicht gefunden",
  error_rate_limited: "Zu viele Anfragen — in einer Minute erneut versuchen",
};

const FR: Dict = {
  hero_title: "Économisez sur vos charges fixes",
  hero_subtitle: "Nous négocions avec votre fournisseur pour vous. Vous payez 15% de l'économie.",
  hero_cta: "Téléchargez votre facture",
  hero_secondary_cta: "Voir le track record",
  fee_disclaimer: "Pas d'économie = pas de frais",
  nav_dashboard: "Tableau de bord",
  nav_proof: "Track record",
  nav_faq: "FAQ",
  nav_login: "Se connecter",
  nav_logout: "Se déconnecter",
  nav_settings: "Paramètres",
  dashboard_title: "Mes négociations",
  dashboard_total_saved: "Total économisé",
  dashboard_open_negotiations: "Négociations en cours",
  dashboard_completed: "Terminées",
  dashboard_failed: "Échouées",
  dashboard_new_bill_cta: "Télécharger une nouvelle facture",
  dashboard_empty_state: "Pas encore de négociations — téléchargez votre première facture.",
  upload_title: "Téléchargez votre facture",
  upload_drop_here: "Déposez votre facture ici ou cliquez pour choisir",
  upload_too_large: "Fichier supérieur à 10 Mo",
  analyse_title: "Analyse",
  email_title: "E-mail de négociation",
  email_copy: "Copier sujet + message",
  email_copied: "Copié ✓",
  email_share_whatsapp: "Partager via WhatsApp",
  outcome_question: "Comment s'est passée la négociation ?",
  outcome_success: "Réussie",
  outcome_waiting: "Encore en attente",
  outcome_failed: "Refusée",
  outcome_thanks: "Merci ! Votre contribution est maintenant dans notre Track Record.",
  proof_title: "Track record",
  proof_total_saved: "Total économisé",
  proof_basis_actual: "Réel",
  proof_basis_expected: "Attendu",
  error_generic: "Quelque chose s'est mal passé — veuillez réessayer",
  error_network: "Erreur réseau — veuillez réessayer",
  error_unauthorized: "Vous devez être connecté",
  error_not_found: "Page non trouvée",
  error_rate_limited: "Trop de requêtes — réessayez dans une minute",
};

export const DICTIONARIES: Record<Locale, Dict> = { nl: NL, en: EN, de: DE, fr: FR };

export function isLocale(s: string | null | undefined): s is Locale {
  return s === "nl" || s === "en" || s === "de" || s === "fr";
}

export function parseAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  // Parse first quality-weighted entry that maps to a supported locale
  const parts = header
    .split(",")
    .map((s) => s.trim().split(";")[0].toLowerCase().slice(0, 2));
  for (const code of parts) {
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}

export async function resolveLocale(): Promise<Locale> {
  try {
    const c = await cookies();
    const v = c.get(LOCALE_COOKIE)?.value;
    if (isLocale(v)) return v;
  } catch {
    /* not in request scope */
  }
  try {
    const h = await headers();
    return parseAcceptLanguage(h.get("accept-language"));
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function t(locale: Locale, key: DictKey): string {
  return DICTIONARIES[locale]?.[key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
}

/** Synchronous translator factory — use server-side after `resolveLocale()`. */
export function makeT(locale: Locale): (key: DictKey) => string {
  return (key) => t(locale, key);
}
