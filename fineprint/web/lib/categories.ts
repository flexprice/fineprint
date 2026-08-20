// fineprint/web/lib/categories.ts
// Generic commercial-billing categories — apply to any contract (SEC filings, licenses,
// services agreements), not a product-specific schema. Shared by annotated-contract.tsx
// and annotated-result.tsx.
export const CAT_COLOR: Record<string, string> = {
  Term: "#7b84e6", Parties: "#5aa9c9", "Recurring Fee": "#33b39c", "Usage Fee": "#b06fd0",
  "One-time Fee": "#33a06a", Payment: "#e08a3c", Penalty: "#e06a6a", Commitment: "#3aa6e0",
  Discount: "#d081a8", Other: "#98a0ab",
};
