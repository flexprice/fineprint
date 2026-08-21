// fineprint/web/lib/categories.ts
// Generic commercial-billing categories — apply to any contract (SEC filings, licenses,
// services agreements), not a product-specific schema. Shared by contract-viewer.tsx
// and output-panel.tsx.
// Superset of two category vocabularies so BOTH render color-coded: the bundled Guidewire
// sample (sample.json, adapted in playground.tsx) and the LIVE reasoner output from /extract
// (pipeline/reasoner.py `_FIELD_CATEGORY`: Identity, Customer, Recurring Fee, Fixed Fee,
// Usage Fee, Credit Grant, Entitlement, Override, Commitment, Terms, Other).
export const CAT_COLOR: Record<string, string> = {
  // identity / term / parties
  Identity: "#7b84e6", Term: "#7b84e6", Terms: "#7b84e6",
  Parties: "#5aa9c9", Customer: "#5aa9c9",
  // fee lines
  "Recurring Fee": "#33b39c", "Fixed Fee": "#e08a3c", "Usage Fee": "#b06fd0", "One-time Fee": "#33a06a",
  // credits / commitments / entitlements
  "Credit Grant": "#33a06a", Commitment: "#3aa6e0", Entitlement: "#3aa6e0",
  // payment / penalty / overrides / discounts
  Payment: "#d59030", Penalty: "#e06a6a", Override: "#d081a8", Discount: "#d081a8",
  Other: "#98a0ab",
};
