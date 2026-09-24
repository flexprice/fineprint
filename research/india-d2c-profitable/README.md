# Top 100 profitable Indian D2C brands

Research snapshot as of **September 2026**. Figures are from the latest year filed or reported for each brand: FY26 where available, otherwise FY25, and FY24 or older only where nothing newer exists.

| File | What it is |
|---|---|
| `top100_profitable_d2c_brands_india.csv` | The main list: 100 brands with financials, a profitability tier and customer estimates |
| `checked_loss_making_brands.csv` | 92 D2C brands checked and **excluded** because their latest filed year was a loss |
| `raw/*.csv` | Research sheets by category, with the source URL and notes for every figure |
| `build.py` | Rebuilds the main CSV from `raw/`: brand metadata, assumptions and estimate formulas |

## The main finding: fewer than 100 D2C brands are profitable

Research covered about 280 Indian D2C and digital-first brands. Only about **36** have a filed or reported positive **PAT** (profit after tax) for FY25 or FY26 *and* are clearly digital-first. Many well-known names are still loss-making, including Sugar, Licious, Pilgrim, WOW, Foxtale, GIVA, Atomberg, The Sleep Company, Mokobara, XYXX and Bewakoof. The complete excluded list is in `checked_loss_making_brands.csv`.

Filling 100 rows with only "profitable" brands would have meant inventing figures. Instead, every row carries a **tier**:

| Tier | Count | Meaning |
|---|---|---|
| **A: Verified profitable** | 36 | Filed or reported PAT above zero in FY25 or FY26, and the brand is digital-first |
| **B: Profitable with a caveat** | 31 | PAT above zero, but with at least one of these: <br>• the only profitable year is FY24 or older<br>• company claim only, not audited<br>• sources disagree<br>• profitable only at pre-tax level<br>• weak D2C fit (distributor-led, store-led, licensed or B2B-heavy) |
| **C: Close to profitable (estimate)** | 33 | PAT not confirmed. Either EBITDA-positive, near breakeven (loss under ~3% of revenue), historically profitable, or profit figure behind a paywall |

Within each tier, brands are ranked by revenue.

## Columns

- **Financials** (₹ crore): `revenue_inr_cr` is operating revenue. `pat_bottomline_inr_cr` is profit after tax (the bottom line). `ebitda_inr_cr` is EBITDA; some values are derived from a reported margin or are Inc42 estimates, and the `notes` or raw sheet says which.
- **Profitability**: `profitability_status` is a plain-English verdict. `data_confidence` is High, Medium or Low.
- **Customer estimates** (all of these are estimates):
  - `est_aov_inr`: typical consumer basket size (average order value). A real AOV was disclosed only for Nutrabay.
  - `est_purchase_freq_per_year`: typical orders per customer per year for the category.
  - `gross_up_factor`: converts the brand's net revenue into consumer spend. It adds GST plus retailer or distributor margin:

    | Channel | Factor |
    |---|---|
    | Digital-led | ~1.15 |
    | Omnichannel | ~1.3 |
    | Distributor-led | ~1.45 |
    | Exports or low-GST jewellery | ~1.0–1.05 |
  - `est_orders_per_year`, `est_orders_per_month`
  - `est_unique_customers_per_year`, with a `_range` column giving 0.6× to 1.5× of that
  - `est_active_customers_per_month`
  - `disclosed_customer_metric`: any real number the brand has disclosed, for cross-checking.

### Customer estimation formula

```
consumer_spend        = revenue × 1e7 × gross_up × (B2C share, e.g. Zappfresh 32%)
orders / year         = consumer_spend ÷ AOV
unique customers / yr = orders ÷ purchase frequency
active customers / mo = unique customers × min(1, frequency ÷ 12)
```

These estimates count customers across **all channels**: own site, marketplaces, quick-commerce and offline. They are not own-website customers only.

### Sanity checks against disclosed numbers

| Brand | Disclosed | Estimate |
|---|---|---|
| Lenskart | 35.3 mn units in FY26 | ~28 mn orders at ~1.25 units per order |
| Country Delight | 5 mn+ orders per month (2022) | ~4.8 mn per month |
| Arata | 50k own-site orders per month (32% of sales) | ~100k across all channels |
| Nutrabay | 15–20k new customers per month | ~180k unique customers per year |

## Caveats

1. **Web research, not audited filings.** Most numbers come from Entrackr, Inc42 and The Ken reporting on ROC filings, from exchange filings (Lenskart, Honasa, BlueStone, Wakefit, Go Fashion, Nureca, and SME listings such as Cellecor, Bizotic, Sat Kartar, Macobs, Signoria and Kiaasa), and from IPO prospectuses (boAt). Figures sourced from Inc42 Datalabs may be total income rather than operating revenue.
2. **Legal entity names.** Where the legal entity could not be confirmed, the entity column says "entity per filings" or "not confirmed".
3. **Mostly overseas customers.** Vahdam, Skillmatics and Ultrahuman make most of their revenue abroad.
4. **Distributor-led inclusions.** Milky Mist, Lahori, iD Fresh, Epigamia and Paper Boat are counted by retail consumer transactions of low-priced items, so their "customer" counts are rough reach proxies, not D2C customer counts.
5. **Coverage gaps.** Web-search quotas ran out partway through, so some bootstrapped brands likely to be profitable are missing or have no profit figure. These include Agaro, Crossbeats, Soulflower, Steadfast, Nakpro, Asitis, Bigmuscles, Brillare and Vilvah. A paid Tofler or Private Circle pull would close these gaps.
