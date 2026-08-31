const SCHEMA: {
  name: string;
  hint: string;
  fields: string[];
}[] = [
  {
    name: "Identity",
    hint: "When the deal starts and how big it is.",
    fields: ["start_date", "currency", "usage_plan_class", "contract_value"],
  },
  {
    name: "Platform fee",
    hint: "The core recurring charge for the product.",
    fields: ["amount", "frequency", "timing"],
  },
  {
    name: "Hosting fee",
    hint: "Infrastructure or environment charges.",
    fields: ["amount", "frequency", "timing"],
  },
  {
    name: "Usage fee",
    hint: "Metered or consumption-based pricing.",
    fields: ["amount", "frequency", "timing"],
  },
  {
    name: "Credit grant",
    hint: "Prepaid credits or promotional balances.",
    fields: ["amount", "type"],
  },
  {
    name: "Entitlement",
    hint: "What the customer is allowed to use.",
    fields: ["quantity", "unit", "period"],
  },
  {
    name: "Commitment",
    hint: "Minimum spend and true-up rules.",
    fields: ["amount", "period", "overage_factor", "true_up"],
  },
  {
    name: "Overrides",
    hint: "Custom rates that break the standard schedule.",
    fields: ["per-unit rates", "other"],
  },
  {
    name: "Customer",
    hint: "Who the invoice goes to.",
    fields: ["name", "email", "address"],
  },
];

function SchemaColumn({ items, startIndex }: { items: typeof SCHEMA; startIndex: number }) {
  return (
    <div className="fp-schema-col">
      {items.map((group, i) => (
        <article key={group.name} className="fp-schema-item">
          <span className="fp-schema-index">{String(startIndex + i + 1).padStart(2, "0")}</span>
          <div className="fp-schema-item-body">
            <h4 className="fp-schema-name">{group.name}</h4>
            <p className="fp-schema-hint">{group.hint}</p>
            <div className="fp-schema-fields">
              {group.fields.map((f) => (
                <code key={f} className="fp-schema-field">{f}</code>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function MethodologyBillingSchema() {
  const cols = [
    SCHEMA.slice(0, 3),
    SCHEMA.slice(3, 6),
    SCHEMA.slice(6, 9),
  ];

  return (
    <div className="fp-schema-sheet">
      <div className="fp-schema-intro">
        <h3 className="fp-schema-title">What we look for in every contract</h3>
        <p className="fp-schema-lead">
          These are the billing fields we expect on every scan. Miss one, and the invoice breaks.
        </p>
      </div>
      <div className="fp-schema-columns">
        {cols.map((col, i) => (
          <SchemaColumn key={i} items={col} startIndex={i * 3} />
        ))}
      </div>
    </div>
  );
}
