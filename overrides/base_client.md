# Example client rules

An **illustrative** per-client overlay layered on top of `default.md`. It shows how a specific
vendor/customer's billing conventions refine the base schema. All companies and figures below are
fictional examples — replace this file with your own client's conventions.

## Precedence
- On any conflict between a Master Agreement (MSA) and an Order Form, the **Order Form controls**.
- Prefer negotiated / current / net / payable Order Form amounts over standard / list / gross amounts
  when both appear for the same line item.
- On a redlined/struck value, the later / edited value is active; ignore the struck original.

## Fee taxonomy (map each stated fee to exactly one field)
- `Platform fee` / `Subscription fee` / `Base license fee` → `recurring_fee`. Do not fold drawable usage
  banks, usage commitments, hosting, or pass-through charges into it.
- A fixed infrastructure/hosting charge stated as `$X / period` → `fixed_fee`. An order-specific
  per-unit hosting rate (e.g. `$0.05 / minute`) → `override_hosting_per_min`, not `fixed_fee`.
- `Usage fee` / `Consumption fee: $X per period` → `usage_fee` (a recurring usage charge, NOT a
  commitment, unless bank/minimum/committed-spend language is present).
- A `committed spend`, `prepaid usage bank`, `minimum annual commitment`, or `usage credits` line is a
  commitment/credit-grant signal: populate `commitment.amount` and `credit_grant.amount`.
- `credit_grant.type` = `one time` for an Order Form bank/credit/committed-spend grant, even when the
  bank is annual, drawn over time, or paid in installments.

## Cadence, installments, and periods
- `frequency` MUST be exactly one of `Monthly`, `Quarterly`, `Half Yearly`, `Annual` (or `N/A`). Map any
  other phrase to the nearest value (`per 90 days` → `Quarterly`, `per annum` → `Annual`, …).
- A fee stated as `Total payable in K equal <period> installments` decomposes to
  `amount = Total / K`, `frequency = <period>`. Example: `$240,000 in 4 equal quarterly installments`
  → amount `60000`, frequency `Quarterly`.
- `frequency` is the **billing cadence** (how often invoiced), which may differ from a coverage/commitment
  period. When a commitment or bank is described as annual/per-annum, set `commitment.period` = `annual`
  even if invoices are quarterly or monthly.

## Per-unit override derivation
- `override_hosting_per_min` is the effective per-unit hosting rate. In order: (1) use an explicitly
  stated per-unit rate; (2) else derive from a bundled usage fee ÷ its included units for the same period
  (e.g. `$200,000/yr for 2,000,000 minutes` → `0.10`); (3) else, if usage is all-inclusive with no
  per-unit charge, `0`. Do not use third-party pass-through rate-card values as this rate.
- Convert cent rates to dollars (`4.8¢/min` → `0.048`).

## Overage
- `commitment.overage_factor` = the overage multiplier `N` only when `Nx` is an explicit multiplier for
  usage above a commitment. If a commitment exists and overages are at standard rates, use `1.0`. With no
  commitment/overage construct, use `0.0`.

## Timing (advanced vs arrear)
- Fees billed upfront (due at signing, in advance, prepaid) → `advanced`. Fees billed after consumption /
  in arrears → `arrear`. Infer from the payment language when the words aren't used, and mark
  `NEEDS_REVIEW` when inferred.
