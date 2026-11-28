// What the assistant can look up or prepare. Used both by Claude (as tools) and
// by the built-in command reader. Lookups read only the signed-in user's data.
// "draft_" tools never save anything: they return a card the user must confirm.
const Buyer = require("../models/Buyer");
const Item = require("../models/Item");
const Invoice = require("../models/Invoice");
const { buildInsights } = require("./insights");
const { summaryReport, gstReport } = require("./reports");
const { computeStock } = require("./stock");
const { outstandingOf } = require("./ledger");
const { computeTotals, taxTypeFor, GST_RATES } = require("./gst");
const { saveDraft } = require("./assistantActions");
const { stateCodeFor, GST_STATES } = require("./states");
const { canUseTool, roleOf } = require("./permissions");
const UNITS = require("./units");
const { round2, istDate, normaliseName, BadRequest } = require("./common");

const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const PERIODS = ["today", "this_week", "this_month", "last_month", "this_year"];
const PERIOD_LABELS = {
  today: "today", this_week: "in the last 7 days", this_month: "this month",
  last_month: "last month", this_year: "this financial year",
};

// Indian calendar dates for a named period
function periodRange(period = "this_month") {
  const today = istDate(Date.now());
  const [y, m] = today.split("-").map(Number);
  const day = (yy, mm, dd) => new Date(Date.UTC(yy, mm, dd)).toISOString().slice(0, 10);
  switch (period) {
    case "today":
      return { from: today, to: today };
    case "this_week":
      return { from: istDate(Date.now() - 6 * 86400000), to: today };
    case "last_month":
      return { from: day(y, m - 2, 1), to: day(y, m - 1, 0) };
    case "this_year":
      return { from: day(m >= 4 ? y : y - 1, 3, 1), to: today };
    default:
      return { from: day(y, m - 1, 1), to: today };
  }
}

const period = (value) => (PERIODS.includes(value) ? value : "this_month");

const table = (title, rows, extra = {}) => ({ kind: "table", title, rows, ...extra });

// ─── Finding records by name ────────────────────────────────────────────────
function matchByName(list, name) {
  const wanted = normaliseName(name);
  if (!wanted) return [];
  const exact = list.filter((x) => normaliseName(x.name) === wanted);
  if (exact.length) return exact;
  const starts = list.filter((x) => normaliseName(x.name).startsWith(wanted));
  if (starts.length) return starts;
  const words = wanted.split(" ");
  return list.filter((x) => words.every((w) => normaliseName(x.name).includes(w)));
}

async function findBuyer(user, name) {
  const buyers = await Buyer.find({ user: user._id });
  const found = matchByName(buyers, name);
  if (found.length > 1) {
    throw new BadRequest(
      `More than one buyer matches "${name}": ${found.slice(0, 5).map((b) => b.name).join(", ")}. Say the full name.`,
    );
  }
  return found[0] || null;
}

// ─── Lookups ─────────────────────────────────────────────────────────────────
const lookups = {
  async business_overview(user) {
    const i = await buildInsights(user);
    return {
      data: {
        thisMonth: i.thisMonth, receivables: { total: i.receivables.total, overdueTotal: i.receivables.overdueTotal },
        payables: i.payables, attention: i.attention.map(({ title, detail }) => ({ title, detail })),
      },
      summary: i.attention.length
        ? `${i.attention.length} thing${i.attention.length === 1 ? " needs" : "s need"} your attention.`
        : "Nothing is waiting on you right now.",
      card: table(
        "Today at a glance",
        [
          { label: `Sales, ${i.thisMonth.label}`, value: rupees(i.thisMonth.sales) },
          { label: "To collect", value: rupees(i.receivables.total), tone: i.receivables.overdueCount ? "bad" : "" },
          { label: "To pay sellers", value: rupees(i.payables.total) },
          ...i.attention.slice(0, 4).map((a) => ({ label: a.title, value: "Open", to: a.to })),
        ],
        { link: { to: "/dashboard", label: "Open overview" } },
      ),
    };
  },

  async sales_report(user, input) {
    const key = period(input.period);
    const { from, to } = periodRange(key);
    const r = await summaryReport(user._id, from, to);
    const net = round2(r.sales.total - r.returns.total);
    return {
      data: { from, to, invoices: r.sales.count, netSales: net, taxable: r.sales.taxable, tax: r.sales.tax, returns: r.returns.total },
      summary: `You sold ${rupees(net)} ${PERIOD_LABELS[key]}.`,
      card: table(`Sales ${PERIOD_LABELS[key]}`, [
        { label: "Invoices", value: String(r.sales.count) },
        { label: "Before GST", value: rupees(r.sales.taxable) },
        { label: "GST", value: rupees(r.sales.tax) },
        ...(r.returns.total ? [{ label: "Returns", value: `−${rupees(r.returns.total)}` }] : []),
        { label: "Net sales", value: rupees(net), strong: true },
      ], { link: { to: "/reports", label: "Full report" } }),
    };
  },

  async top_products(user, input) {
    const key = period(input.period);
    const { from, to } = periodRange(key);
    const limit = Math.min(Math.max(Number(input.limit) || 5, 1), 10);
    const top = (await summaryReport(user._id, from, to)).products.filter((p) => p.total > 0).slice(0, limit);
    return {
      data: { from, to, products: top.map(({ name, quantity, unit, total }) => ({ name, quantity, unit, total })) },
      summary: top.length
        ? `Top ${top.length} product${top.length === 1 ? "" : "s"} by sales ${PERIOD_LABELS[key]}:`
        : `No products were sold ${PERIOD_LABELS[key]}.`,
      card: top.length
        ? table("Top products", top.map((p) => ({ label: p.name, note: `${p.quantity} ${p.unit}`, value: rupees(p.total) })),
            { link: { to: "/reports?tab=products", label: "All products" } })
        : null,
    };
  },

  async top_buyers(user, input) {
    const key = period(input.period);
    const { from, to } = periodRange(key);
    const top = (await summaryReport(user._id, from, to)).buyers.slice(0, 5);
    return {
      data: { from, to, buyers: top.map(({ name, total, balance }) => ({ name, total, balance })) },
      summary: top.length ? `Your best buyers ${PERIOD_LABELS[key]}:` : `No sales ${PERIOD_LABELS[key]}.`,
      card: top.length
        ? table("Top buyers", top.map((b) => ({ label: b.name, note: `${b.invoices} invoice${b.invoices === 1 ? "" : "s"}`, value: rupees(b.total), to: b.id ? `/buyers/${b.id}` : "" })))
        : null,
    };
  },

  async stock_status(user, input) {
    const stock = await computeStock(user._id);
    if (!stock.length) {
      return {
        data: { tracked: 0 },
        summary: "No products are tracked yet. Switch on “Track stock” on a product to see stock value.",
        card: table("Stock", [{ label: "Tracked products", value: "0", to: "/items" }], { link: { to: "/items", label: "Open products" } }),
      };
    }
    const value = round2(stock.reduce((s, x) => s + x.value, 0));
    const low = stock.filter((s) => s.low);
    const shown = input.only_low ? low : [...stock].sort((a, b) => b.value - a.value);
    return {
      data: { stockValueAtCost: value, tracked: stock.length, low: low.length, items: shown.slice(0, 15).map(({ name, stock: qty, unit, value: v, low: isLow }) => ({ name, quantity: qty, unit, value: v, low: isLow })) },
      summary: input.only_low
        ? low.length ? `${low.length} product${low.length === 1 ? " is" : "s are"} running low.` : "Nothing is running low."
        : `Your stock is worth ${rupees(value)} at purchase price.`,
      card: shown.length
        ? table(input.only_low ? "Low stock" : "Stock", [
            ...shown.slice(0, 5).map((s) => ({ label: s.name, note: `${s.stock} ${s.unit}${s.low ? " · low" : ""}`, value: rupees(s.value), tone: s.low ? "bad" : "" })),
            ...(input.only_low ? [] : [{ label: "Total stock value", value: rupees(value), strong: true }]),
          ], { link: { to: "/stock", label: "Open stock" } })
        : null,
    };
  },

  async dues(user, input) {
    if (input.buyer_name) {
      const buyer = await findBuyer(user, input.buyer_name);
      if (!buyer) throw new BadRequest(`I could not find a buyer called "${input.buyer_name}".`);
      const invoices = await Invoice.find({ user: user._id, buyer: buyer._id, status: { $ne: "cancelled" } }).sort({ invoiceDate: 1 });
      const owed = outstandingOf(buyer, invoices);
      const open = invoices.filter((i) => i.balanceAmount > 0);
      return {
        data: { buyer: buyer.name, owes: owed.total, openingBalance: owed.opening, openInvoices: open.slice(0, 15).map((i) => ({ number: i.invoiceNumber, date: istDate(i.invoiceDate), balance: i.balanceAmount })) },
        summary: owed.total ? `${buyer.name} owes you ${rupees(owed.total)}.` : `${buyer.name} owes you nothing.`,
        card: table(buyer.name, [
          ...(owed.opening ? [{ label: "Opening balance", value: rupees(owed.opening) }] : []),
          ...open.slice(0, 5).map((i) => ({ label: i.invoiceNumber, note: istDate(i.invoiceDate), value: rupees(i.balanceAmount), to: `/invoices/${i._id}` })),
          { label: "Total due", value: rupees(owed.total), strong: true },
        ], { link: { to: `/buyers/${buyer._id}`, label: "Open statement" } }),
      };
    }
    const { receivables } = await buildInsights(user);
    const rows = receivables.buyers.slice(0, 6);
    const note = (b) =>
      b.daysOverdue ? `${b.daysOverdue} day${b.daysOverdue === 1 ? "" : "s"} late`
        : b.invoices ? "Not yet due" : "Opening balance";
    return {
      data: {
        total: receivables.total,
        overdueTotal: receivables.overdueTotal,
        buyers: receivables.buyers.map(({ name, due, daysOverdue }) => ({ buyer: name, owes: due, daysOverdue })),
        overdueInvoices: receivables.overdue.slice(0, 5).map(({ buyer, invoiceNumber, balance, daysOverdue }) => ({ buyer, invoiceNumber, balance, daysOverdue })),
      },
      summary: receivables.total
        ? `You have ${rupees(receivables.total)} to collect. ${receivables.overdueTotal ? `${rupees(receivables.overdueTotal)} of it is overdue.` : "Nothing is overdue yet."}`
        : "Nobody owes you money right now.",
      card: receivables.total
        ? table("Money to collect", [
            ...rows.map((b) => ({ label: b.name, note: note(b), value: rupees(b.due), tone: b.daysOverdue ? "bad" : "", to: `/buyers/${b.id}` })),
            { label: "Total to collect", value: rupees(receivables.total), strong: true },
          ], { link: { to: "/buyers", label: "All buyers" } })
        : null,
    };
  },

  async gst_estimate(user, input) {
    const key = period(input.period);
    const { from, to } = periodRange(key);
    const { gstr3b } = await gstReport(user, from, to);
    return {
      data: { from, to, taxCollected: gstr3b.outputTax, inputCredit: gstr3b.inputTax, payable: gstr3b.payable, carryForward: gstr3b.carryForward, note: "Estimate from records in the app" },
      summary: `Estimated GST payable ${PERIOD_LABELS[key]}: ${rupees(gstr3b.payable)}. Confirm with your accountant before filing.`,
      card: table(`GST ${PERIOD_LABELS[key]}`, [
        { label: "Collected on sales", value: rupees(gstr3b.outputTax) },
        { label: "Input credit", value: `−${rupees(gstr3b.inputTax)}` },
        ...(gstr3b.carryForward ? [{ label: "Credit to carry forward", value: rupees(gstr3b.carryForward) }] : []),
        { label: "Estimated payable", value: rupees(gstr3b.payable), strong: true },
      ], { link: { to: "/reports?tab=gst", label: "GST working sheets" } }),
    };
  },

  async profit_report(user, input) {
    const key = period(input.period);
    const { from, to } = periodRange(key);
    const { profit } = await summaryReport(user._id, from, to);
    const coverage = Math.round(profit.costCoverage * 100);
    return {
      data: { from, to, ...profit },
      summary: `Estimated profit ${PERIOD_LABELS[key]}: ${rupees(profit.profit)}.` +
        (profit.revenue > 0 && coverage < 100 ? ` Only ${coverage}% of sales have a purchase price, so the real figure is lower.` : ""),
      card: table(`Profit ${PERIOD_LABELS[key]}`, [
        { label: "Sales before GST", value: rupees(profit.revenue) },
        { label: "Cost of goods", value: `−${rupees(profit.goodsCost)}` },
        { label: "Expenses", value: `−${rupees(profit.expenses)}` },
        { label: "Estimated profit", value: rupees(profit.profit), strong: true, tone: profit.profit < 0 ? "bad" : "good" },
      ], { link: { to: "/reports", label: "Profit report" } }),
    };
  },

  async expense_report(user, input) {
    const key = period(input.period);
    const { from, to } = periodRange(key);
    const { expenses } = await summaryReport(user._id, from, to);
    return {
      data: { from, to, ...expenses },
      summary: `You spent ${rupees(expenses.total)} ${PERIOD_LABELS[key]}.`,
      card: expenses.total
        ? table("Expenses", [
            ...expenses.byCategory.slice(0, 6).map((c) => ({ label: c.category, value: rupees(c.amount) })),
            { label: "Total", value: rupees(expenses.total), strong: true },
          ], { link: { to: "/expenses", label: "Open expenses" } })
        : null,
    };
  },
};

// ─── Drafts: prepared now, saved only when the user confirms ─────────────────
const drafts = {
  async draft_invoice(user, input) {
    const isQuote = input.document_type === "quotation";
    const noun = isQuote ? "quotation" : "invoice";
    const buyerName = String(input.buyer_name || "").trim();
    if (!buyerName) throw new BadRequest("Who is the bill for?");
    const requested = Array.isArray(input.items) ? input.items : [];
    if (!requested.length) throw new BadRequest("What should be on the bill?");

    const buyer = await findBuyer(user, buyerName);
    const catalogue = await Item.find({ user: user._id }).lean();
    const assumptions = [];

    const lines = requested.map((line) => {
      const name = String(line?.name || "").trim();
      if (!name) throw new BadRequest("Every item needs a name");
      const matches = matchByName(catalogue, name);
      const product = matches.length === 1 ? matches[0] : null;
      const fromProduct = Boolean(product) && (line.rate === undefined || line.rate === null || line.rate === "");
      const rate = line.rate ?? product?.price;
      if (rate === undefined || rate === null || rate === "") {
        throw new BadRequest(`What is the rate for ${product?.name || name}?`);
      }
      const gstPercent = line.gst_percent ?? product?.gstPercent ?? 18;
      if (line.gst_percent === undefined && !product) assumptions.push(`${name}: GST taken as 18%`);
      return {
        // A price taken from the product follows how that product is priced
        ...(product && { cessType: product.cessType, cessValue: product.cessValue }),
        // The product's price brings its discount with it, and its tax setting
        // unless the person said the rates include GST
        ...(fromProduct && { discountType: product.discountType, discountValue: product.discountValue }),
        ...(fromProduct && !input.rates_include_gst && { taxMode: product.taxMode }),
        item: product?._id ? String(product._id) : null,
        name: product?.name || name,
        hsn: product?.hsn || "",
        unit: product?.unit || (UNITS.includes(line.unit) ? line.unit : "pcs"),
        quantity: Number(line.quantity) || 1,
        rate: Number(rate),
        gstPercent: Number(gstPercent),
      };
    });

    const taxMode = input.rates_include_gst ? "inclusive" : "exclusive";
    const taxType = taxTypeFor(user.supplierStateCode || "07", buyer?.stateCode || "", buyer?.gstTreatment);
    const totals = computeTotals(lines, { taxType, taxMode });
    if (!buyer) assumptions.unshift(`${buyerName} is new and will be added as a buyer (billed as same state)`);

    const draftId = saveDraft(user, {
      type: noun,
      buyerId: buyer ? String(buyer._id) : null,
      newBuyer: buyer ? null : buyerName,
      items: lines,
      taxMode,
    });

    return {
      data: { status: "draft_ready_waiting_for_user_to_confirm", buyer: buyer?.name || buyerName, total: totals.grandTotal, tax: totals.totalTax, assumptions },
      summary: `Here is the ${noun} draft. Check it, then confirm to save.`,
      card: {
        kind: "draft",
        draftId,
        title: isQuote ? "Quotation draft" : "Invoice draft",
        party: buyer?.name || buyerName,
        lines: totals.items.map((l) => ({ name: l.name, detail: `${l.quantity} ${l.unit} × ${rupees(l.rate)} · GST ${l.gstPercent}%`, amount: rupees(l.totalAmount) })),
        rows: [
          { label: taxMode === "inclusive" ? "Before GST" : "Taxable value", value: rupees(totals.subTotal) },
          { label: taxType === "igst" ? "IGST" : "CGST + SGST", value: rupees(totals.totalTax) },
          { label: "Total", value: rupees(totals.grandTotal), strong: true },
        ],
        notes: assumptions,
        confirmLabel: `Create ${noun}`,
      },
    };
  },

  async draft_payment(user, input) {
    const buyer = await findBuyer(user, input.buyer_name);
    if (!buyer) throw new BadRequest(`I could not find a buyer called "${input.buyer_name || ""}".`);
    const amount = round2(input.amount);
    if (!(amount > 0)) throw new BadRequest("How much was received?");
    const invoices = await Invoice.find({ user: user._id, buyer: buyer._id, status: { $ne: "cancelled" } });
    const owed = outstandingOf(buyer, invoices).total;
    if (amount > owed + 0.001) {
      throw new BadRequest(`${buyer.name} owes ${rupees(owed)}, so I cannot record ${rupees(amount)}.`);
    }
    const mode = ["cash", "upi", "bank_transfer", "cheque", "card", "other"].includes(input.mode) ? input.mode : "upi";
    const draftId = saveDraft(user, { type: "payment", buyerId: String(buyer._id), amount, mode, note: String(input.note || "") });
    return {
      data: { status: "draft_ready_waiting_for_user_to_confirm", buyer: buyer.name, amount, owesNow: owed },
      summary: "Check the payment, then confirm to record it.",
      card: {
        kind: "draft", draftId, title: "Payment received", party: buyer.name,
        rows: [
          { label: "Received by", value: mode.replace("_", " ") },
          { label: "Owes now", value: rupees(owed) },
          { label: "Left after this", value: rupees(round2(owed - amount)) },
          { label: "Amount", value: rupees(amount), strong: true },
        ],
        notes: ["Applied to the oldest bills first"],
        confirmLabel: "Record payment",
      },
    };
  },

  async draft_expense(user, input) {
    const amount = round2(input.amount);
    const category = String(input.category || "").trim();
    if (!(amount > 0)) throw new BadRequest("How much was spent?");
    if (!category) throw new BadRequest("What was the expense for?");
    const mode = ["cash", "upi", "bank_transfer", "cheque", "card", "other"].includes(input.mode) ? input.mode : "cash";
    const nice = category.charAt(0).toUpperCase() + category.slice(1);
    const draftId = saveDraft(user, { type: "expense", amount, category: nice, mode, note: String(input.note || "") });
    return {
      data: { status: "draft_ready_waiting_for_user_to_confirm", category: nice, amount, mode },
      summary: "Check the expense, then confirm to save it.",
      card: {
        kind: "draft", draftId, title: "New expense",
        rows: [
          { label: "Category", value: nice },
          { label: "Paid by", value: mode.replace("_", " ") },
          { label: "Amount", value: rupees(amount), strong: true },
        ],
        confirmLabel: "Save expense",
      },
    };
  },

  async draft_buyer(user, input) {
    const name = String(input.name || "").trim();
    if (!name) throw new BadRequest("What is the buyer's name?");
    const existing = (await Buyer.find({ user: user._id }).select("name").lean())
      .find((b) => normaliseName(b.name) === normaliseName(name));
    if (existing) throw new BadRequest(`${existing.name} is already in your buyers.`);
    const gstin = String(input.gstin || "").trim().toUpperCase();
    const state = String(input.state || "").trim() || GST_STATES[gstin.slice(0, 2)] || "";
    if (state && !stateCodeFor(state)) throw new BadRequest(`I do not know the state "${state}".`);
    const mobile = String(input.mobile || "").replace(/\D/g, "").slice(-10);
    const draftId = saveDraft(user, { type: "buyer", name, mobile, gstin, state });
    return {
      data: { status: "draft_ready_waiting_for_user_to_confirm", name },
      summary: "Check the details, then confirm to add this buyer.",
      card: {
        kind: "draft", draftId, title: "New buyer", party: name,
        rows: [
          { label: "Mobile", value: mobile || "—" },
          { label: "GSTIN", value: gstin || "Unregistered" },
          { label: "State", value: state || "—" },
        ],
        confirmLabel: "Add buyer",
      },
    };
  },

  async draft_product(user, input) {
    const name = String(input.name || "").trim();
    const price = Number(input.price);
    if (!name) throw new BadRequest("What is the product called?");
    if (!(price >= 0)) throw new BadRequest(`What is the selling price of ${name}?`);
    const gstPercent = input.gst_percent === undefined ? 18 : Number(input.gst_percent);
    if (!GST_RATES.includes(gstPercent)) throw new BadRequest("That GST rate is not supported.");
    const unit = UNITS.includes(input.unit) ? input.unit : "pcs";
    const hsn = String(input.hsn || "").trim();
    const draftId = saveDraft(user, { type: "product", name, price, gstPercent, unit, hsn });
    return {
      data: { status: "draft_ready_waiting_for_user_to_confirm", name, price, gstPercent },
      summary: "Check the product, then confirm to add it.",
      card: {
        kind: "draft", draftId, title: "New product", party: name,
        rows: [
          { label: "Unit", value: unit.toUpperCase() },
          { label: "GST", value: `${gstPercent}%` },
          { label: "HSN/SAC", value: hsn || "—" },
          { label: "Selling price", value: rupees(price), strong: true },
        ],
        confirmLabel: "Add product",
      },
    };
  },
};

const handlers = { ...lookups, ...drafts };

// ─── Tool definitions for Claude ─────────────────────────────────────────────
const str = (description) => ({ type: "string", description });
const num = (description) => ({ type: "number", description });
const periodProp = { type: "string", enum: PERIODS, description: "Defaults to this_month" };
const modeProp = { type: "string", enum: ["cash", "upi", "bank_transfer", "cheque", "card", "other"] };

const tool = (name, description, properties = {}, required = []) => ({
  name,
  description,
  eager_input_streaming: true,
  input_schema: { type: "object", properties, required, additionalProperties: false },
});

const definitions = [
  tool("business_overview", "This month's sales, money to collect and pay, and the list of things needing attention."),
  tool("sales_report", "Sales totals for a period.", { period: periodProp }),
  tool("top_products", "Best selling products by value for a period.", { period: periodProp, limit: num("How many, up to 10") }),
  tool("top_buyers", "Buyers who bought the most in a period.", { period: periodProp }),
  tool("stock_status", "Stock quantities and stock value.", { only_low: { type: "boolean", description: "Only products running low" } }),
  tool("dues", "Money to collect. Give buyer_name for one buyer's account.", { buyer_name: str("Buyer name, if asking about one buyer") }),
  tool("gst_estimate", "Estimated GST payable for a period.", { period: periodProp }),
  tool("profit_report", "Estimated profit for a period.", { period: periodProp }),
  tool("expense_report", "Expenses for a period by category.", { period: periodProp }),
  tool(
    "draft_invoice",
    "Prepare an invoice or quotation for the user to confirm. Nothing is saved until the user presses the button on the card.",
    {
      buyer_name: str("Who the bill is for"),
      document_type: { type: "string", enum: ["invoice", "quotation"] },
      rates_include_gst: { type: "boolean", description: "True only if the user says the rate includes GST" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: str("Product or service"),
            quantity: num("Defaults to 1"),
            unit: str("Unit such as pcs, bag, kg"),
            rate: num("Price per unit; omit to use the saved product price"),
            gst_percent: num("Only if the user states it"),
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
    },
    ["buyer_name", "items"],
  ),
  tool("draft_payment", "Prepare a payment received from a buyer, for the user to confirm.",
    { buyer_name: str("Who paid"), amount: num("Rupees received"), mode: modeProp, note: str("Reference") }, ["buyer_name", "amount"]),
  tool("draft_expense", "Prepare an expense entry, for the user to confirm.",
    { category: str("What it was for"), amount: num("Rupees"), mode: modeProp, note: str("Detail") }, ["category", "amount"]),
  tool("draft_buyer", "Prepare a new buyer, for the user to confirm.",
    { name: str("Name"), mobile: str("Mobile number"), gstin: str("GSTIN"), state: str("Indian state") }, ["name"]),
  tool("draft_product", "Prepare a new product, for the user to confirm.",
    { name: str("Name"), price: num("Selling price before GST"), gst_percent: num("GST rate"), unit: str("Unit"), hsn: str("HSN or SAC code") }, ["name", "price"]),
];

// Model-supplied input is untrusted: check it is an object with the required keys
async function runTool(user, name, input) {
  if (!canUseTool(roleOf(user), name)) {
    throw new BadRequest("Your login does not have access to that. Ask the business owner.");
  }
  const definition = definitions.find((d) => d.name === name);
  if (!definition) throw new BadRequest("Unknown tool");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequest("The tool input was not valid");
  const missing = definition.input_schema.required.filter((k) => input[k] === undefined || input[k] === "");
  if (missing.length) throw new BadRequest(`Missing: ${missing.join(", ")}`);
  const result = await handlers[name](user, input);
  // Staff cannot open the reports screen, so do not offer a link to it
  if (roleOf(user) === "staff" && result.card?.link?.to.startsWith("/reports")) delete result.card.link;
  return result;
}

const STATUS = {
  business_overview: "Looking over your business",
  sales_report: "Adding up sales",
  top_products: "Ranking your products",
  top_buyers: "Ranking your buyers",
  stock_status: "Counting stock",
  dues: "Checking who owes you",
  gst_estimate: "Working out GST",
  profit_report: "Working out profit",
  expense_report: "Adding up expenses",
  draft_invoice: "Writing the draft",
  draft_payment: "Preparing the payment",
  draft_expense: "Preparing the expense",
  draft_buyer: "Preparing the buyer",
  draft_product: "Preparing the product",
};

module.exports = { definitions, runTool, STATUS };
