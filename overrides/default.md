# Default extraction rules

- Prefer values that are explicitly stated over anything inferred. When you must infer, mark the field NEEDS_REVIEW and write a short `doubt`.
- When the contract shows both list/gross/standard amounts and net/discounted/payable/current amounts for the same item, use the net/discounted/payable/current amount for billing fields. Use list/gross amounts only when no payable/current amount is stated.
- Amounts are plain numbers (strip `$` and commas). Percentages/multipliers like `1.5x` -> `1.5`; cent rates convert to dollars (for example, `4.8¢/min` or `4.8 cents/min` -> `0.048`).
- Dates: return ISO `YYYY-MM-DD` for `start_date` when possible.
- If a field genuinely isn't in the contract, mark it MISSING with an empty `line_ids` — do not guess.
- If a fee/credit category is absent or its amount is `0`, do not populate dependent cadence/timing/period fields unless the contract explicitly states them for that zero-dollar item.

## Cadence and periods
- Every fee `frequency` MUST be exactly one of: `Monthly`, `Quarterly`, `Half Yearly`, `Annual` (or `N/A` when there is no recurring cadence). Never output any other phrase (e.g. `per 90 days`, `every quarter`, `24 months`, `bi-annual`) — map it to the nearest allowed value: every ~90 days / per quarter -> `Quarterly`; per month -> `Monthly`; every ~6 months -> `Half Yearly`; per year / per annum -> `Annual`.
- Distinguish billing cadence from coverage/value basis. `frequency` is how often invoiced/paid; words like `annual`, `per annum`, or `12-month term` may describe the price basis or coverage period, not the payment frequency.
- The stated payment schedule controls fee `amount` and `frequency`. If an annual or total amount is payable in equal installments, set amount to the per-installment amount and frequency to the installment cadence: 4 quarterly installments -> `quarterly`; 2 semi-annual installments -> `half yearly`; 12 monthly installments -> `monthly`. If paid once per year, frequency is `annual`.
- If the schedule lists specific installment amounts, use those stated amounts. Only divide a total by K when the installments are stated as equal or no individual installment amounts are given.
- Allocate schedules by line item: do not use a grand total as a single fee when the schedule/itemization separates platform, usage, hosting, credits, or commitments.
- If a payment schedule applies to multiple itemized nonzero fees, apply that cadence/timing to each covered line item rather than leaving individual fee cadence blank.
- `timing` is based on the invoice trigger: `advanced` if due at signing, prepaid, or due before/at the start of the service period; `arrear` if invoiced after consumption or after the service period. Payment terms like `Net 30` only set due date after invoice and do not by themselves imply advanced or arrear.
- Commitment/entitlement `period` is the measurement or grant period, not the invoice cadence. An annual commitment paid quarterly still has commitment period `annual`.
- If commitment language uses annual/per annum/per year/yearly/12-month wording for a usage bank, prepaid balance, committed spend, or minimum usage/spend commitment, populate `commitment.period` = `annual`; do not leave it blank because the billing cadence is different.
- `entitlement.period` should be filled only when the period for included units, credits, bank balance, or minutes is explicitly tied to the entitlement quantity/grant, such as included minutes per year or an annual usage credit bank -> `annual`. Do not copy the contract term, renewal term, payment cadence, fee basis, start/end dates, or draw-down conditions into `entitlement.period`.
- For `start_date`, use the Order Form/SOW/subscription term start or order effective date. If the agreement defines the effective date as the date of full execution and no other start date exists, use the latest signature/execution date. Do not use invoice/payment dates, launch/go-live dates, renewal/end dates, or MSA effective dates when an Order Form start date exists.

## Credit grants and commitments
- Treat any stated monetary usage bank, prepaid bank/balance, usage credit, committed spend, minimum usage/spend commitment, or minimum annual commitment as a presence signal for `credit_grant` and, when it is a committed/minimum/bank spend obligation, for `commitment`. This applies even if the amount is labeled as a fee or is paid in installments.
- For those signals, populate `credit_grant.amount` with the usable/drawable bank, credit, prepaid balance, committed spend, or minimum usage amount for the current grant/commitment period. If a distinct drawable bank/credit amount is stated, use that amount; otherwise use the stated committed/minimum/bank amount. Exclude platform/license or other nondrawable fees.
- When a commitment/minimum/bank spend obligation exists, populate `commitment.amount` with the required minimum or committed spend amount; if no separate minimum is stated for a bank, use the stated committed bank amount.
- When `credit_grant.amount` is populated from a stated bank, prepaid, credit, committed-spend, or minimum-usage amount, set `credit_grant.type` = `one time` unless the contract explicitly requires a different supported type. Do not leave `credit_grant.type` empty/None when such a grant or commitment amount is present.
- For commitment period, annual/per annum/per year/yearly/12-month language tied to the bank, prepaid balance, committed spend, or minimum usage/spend amount means `commitment.period` = `annual`, regardless of invoice frequency.
