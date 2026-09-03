/**
 * lib/groq-models.ts — één bron voor de Groq-modeldefaults.
 *
 * Sept 2026: Groq schrapte het hele Llama-aanbod uit dit tier; elke call
 * faalde stil ("LLM niet beschikbaar"). qwen3.8-27b is live getest: JSON-mode
 * én image_url-input werken. Bij een volgende deprecatie: alléén hier wijzigen
 * (of zonder deploy via env GROQ_TEXT_MODEL / GROQ_VISION_MODEL).
 *
 * NB: qwen/qwen3.6-27b faalt structureel op json_object — nooit als fallback.
 * openai/gpt-oss-* en groq/compound* zijn pas bruikbaar als de owner ze in de
 * Groq-console op project-niveau aanzet ("blocked at the project level").
 */
export const DEFAULT_GROQ_TEXT_MODEL = "qwen/qwen3.8-27b";
export const DEFAULT_GROQ_VISION_MODEL = "qwen/qwen3.8-27b";
