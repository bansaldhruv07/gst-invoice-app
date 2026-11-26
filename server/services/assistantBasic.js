// The built-in command reader: handles common requests in English and simple
// Hinglish without any AI service. It maps a sentence to one of the same tools
// Claude uses.

const toNumber = (s) => Number(String(s).replace(/,/g, ""));

// How the money moved, written after the amount: "by UPI", "cash"
const MODE_TAIL = String.raw`(?:\s+(?:by|via|in|through)\s+.+|\s+(?:cash|upi|cheque|card|gpay|phonepe|paytm))?$`;

function periodOf(text) {
  if (/\b(today|aaj)\b/.test(text)) return "today";
  if (/\b(week|7 days|hafte)\b/.test(text)) return "this_week";
  if (/\b(last|previous|pichle|pichhle)\s+(month|mahine)\b/.test(text)) return "last_month";
  if (/\b(year|saal|annual|fy)\b/.test(text)) return "this_year";
  return "this_month";
}

function modeOf(text) {
  if (/\bcash\b/.test(text)) return "cash";
  if (/\b(upi|gpay|google pay|phonepe|paytm)\b/.test(text)) return "upi";
  if (/\b(bank|neft|rtgs|imps)\b/.test(text)) return "bank_transfer";
  if (/\b(cheque|check)\b/.test(text)) return "cheque";
  if (/\bcard\b/.test(text)) return "card";
  return undefined;
}

const UNIT_WORDS = {
  pcs: "pcs", pc: "pcs", piece: "pcs", pieces: "pcs", nos: "nos", kg: "kg", kgs: "kg", ton: "ton", tons: "ton",
  ltr: "ltr", litre: "ltr", litres: "ltr", liter: "ltr", liters: "ltr", mtr: "mtr", meter: "mtr", meters: "mtr",
  metre: "mtr", metres: "mtr", sqft: "sqft", box: "box", boxes: "box", bag: "bag", bags: "bag",
  bundle: "bundle", bundles: "bundle", carton: "carton", cartons: "carton", roll: "roll", rolls: "roll",
  bucket: "other", buckets: "other", set: "set", sets: "set", pair: "pair", pairs: "pair", dozen: "dozen", hrs: "hrs", hour: "hrs", hours: "hrs",
};

// "2 bags of wall putty at Rs.400" -> { quantity, unit, name, rate }
function parseLine(raw) {
  let text = raw.trim().replace(/[.!]+$/, "");
  const line = {};

  const gst = text.match(/(\d+(?:\.\d+)?)\s*%(\s*(gst|tax))?/i);
  if (gst) {
    line.gst_percent = Number(gst[1]);
    text = text.replace(gst[0], " ");
  }

  // Rate: after "at", "@", "for", "of" or a currency mark, or a trailing number
  const patterns = [
    /(?:@|\bat\b|\brate\b|\bfor\b|\bof\b)?\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)(?:\s*\/-)?(?:\s*(?:each|per\s+\w+))?/i,
    /(?:@|\bat\b|\brate\b)\s*([\d,]+(?:\.\d+)?)(?:\s*\/-)?(?:\s*(?:each|per\s+\w+))?/i,
    /\s([\d,]*\d{2,}(?:\.\d+)?)\s*(?:each|\/-)?$/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      line.rate = toNumber(m[1]);
      text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
      break;
    }
  }

  text = text.replace(/\s+/g, " ").trim().replace(/^(a|an|one)\s+/i, "");
  const qty = text.match(/^(\d+(?:\.\d+)?)\s*(?:x\s+|\*\s*)?([a-z]+)?\s*(.*)$/i);
  if (qty) {
    const unit = UNIT_WORDS[(qty[2] || "").toLowerCase()];
    const rest = unit ? qty[3] : `${qty[2] || ""} ${qty[3]}`;
    if (rest.trim()) {
      line.quantity = Number(qty[1]);
      if (unit) line.unit = unit;
      text = rest.trim().replace(/^of\s+/i, "");
    }
  }

  line.name = text.replace(/\s+(of|at|for|with|rate)$/i, "").replace(/^[-–:]+|[-–:]+$/g, "").trim();
  return line;
}

function parseBill(message) {
  const m = message.match(
    /\b(?:create|make|new|generate|draft|prepare|raise|bana(?:o|do)?)?\s*(?:an?\s+|the\s+)?\b(invoice|bill|quotation|quote|estimate)\b\s*(?:for|to)\s+(.+?)\s*(?:\bwith\b|\bfor\b|\bcontaining\b|\bhaving\b|:|-\s)\s*(.+)$/i,
  ) || message.match(/^(?:please\s+)?(bill|invoice|quote)\s+(.+?)\s*(?:\bwith\b|\bfor\b|:)\s*(.+)$/i);
  if (!m) return null;
  let items = m[3];
  const inclusive = /\b(incl(?:uding|usive)?\.?(\s+of)?|with)\s+(gst|tax)\b/i.test(items);
  items = items.replace(/\s*(\+|\bplus\b|\bexcl(?:uding|usive)?\b|\bincl(?:uding|usive)?\.?(?:\s+of)?\b|\bwith\b)\s*(gst|tax)\b/gi, "");
  // Commas inside numbers (25,000) are not separators
  const lines = items.split(/\s+and\s+|\s*;\s*|,(?!\d{2,3}\b)\s*/i).map(parseLine).filter((l) => l.name);
  return {
    buyer_name: m[2].trim(),
    document_type: /quot|estimate/i.test(m[1]) ? "quotation" : "invoice",
    rates_include_gst: inclusive,
    items: lines,
  };
}

const EXAMPLES = [
  "Create invoice for Raj Traders with Laptop of Rs.25,000 + tax",
  "What is my current stock value?",
  "What are my top selling products this month?",
  "How much does Verma Hardware owe me?",
  "Add expense 500 for transport",
  "Received 5000 from Verma Hardware by UPI",
];

// Returns { tool, input } or null when the sentence is not understood
function understand(message) {
  const original = message.trim().replace(/\s+/g, " ");
  const text = original.toLowerCase().replace(/[?!.]+$/, "");

  const bill = parseBill(original.replace(/[?!]+$/, ""));
  if (bill?.items.length) return { tool: "draft_invoice", input: bill };

  let m = original.match(/^(?:add|record|log|new)?\s*(?:an?\s+)?expense\s+(?:of\s+)?(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)\s*(?:for|on|towards)?\s*(.+)$/i)
    || original.match(/^(?:i\s+)?(?:spent|paid out)\s+(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)\s*(?:for|on|towards)\s+(.+)$/i);
  if (m) {
    const category = m[2].replace(/\b(by|in|via)\s+\w+(\s+\w+)?$/i, "").trim();
    return { tool: "draft_expense", input: { amount: toNumber(m[1]), category, mode: modeOf(text) } };
  }

  m = original.match(new RegExp(
    String.raw`^(?:received|got|recieved)\s+(?:payment\s+of\s+)?(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)\s+from\s+(.+?)` + MODE_TAIL, "i"));
  if (m) return { tool: "draft_payment", input: { amount: toNumber(m[1]), buyer_name: m[2].trim(), mode: modeOf(text) } };
  m = original.match(new RegExp(
    String.raw`^(.+?)\s+(?:paid|gave|has paid)\s+(?:me\s+)?(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)` + MODE_TAIL, "i"));
  if (m && !/^(i|we)$/i.test(m[1])) {
    return { tool: "draft_payment", input: { buyer_name: m[1].trim(), amount: toNumber(m[2]), mode: modeOf(text) } };
  }

  m = original.match(/^(?:add|create|new)\s+(?:a\s+)?(?:buyer|customer|party)\s+(?:named\s+|called\s+)?(.+)$/i);
  if (m) {
    const mobile = m[1].match(/\b\d{10}\b/)?.[0];
    const gstin = m[1].match(/\b\d{2}[a-z]{5}\d{4}[a-z]\w[z]\w\b/i)?.[0];
    const name = m[1].replace(mobile || "", "").replace(gstin || "", "")
      .replace(/,?\s*\b(mobile|phone|gstin|gst|number|no)\b\.?:?/gi, "").replace(/[,\s]+$/, "").trim();
    return { tool: "draft_buyer", input: { name, mobile, gstin } };
  }

  m = original.match(/^(?:add|create|new)\s+(?:a\s+)?(?:product|item)\s+(?:named\s+|called\s+)?(.+)$/i);
  if (m) {
    const line = parseLine(m[1]);
    return { tool: "draft_product", input: { name: line.name, price: line.rate, gst_percent: line.gst_percent, unit: line.unit } };
  }

  const period = periodOf(text);

  m = original.match(/(?:how much (?:does|do|is)\s+)(.+?)\s+(?:owe|owes|due)\b/i)
    || original.match(/(?:balance|dues?|outstanding|account|statement)\s+(?:of|for)\s+(.+?)[?.]*$/i)
    || original.match(/^(.+?)\s+(?:ka|ke)\s+(?:balance|baki|udhaar|hisab)\b/i);
  if (m && !/^(my|the|all|buyers?|customers?)\b/i.test(m[1])) {
    return { tool: "dues", input: { buyer_name: m[1].trim() } };
  }

  if (/low stock|running (low|out)|out of stock|reorder/.test(text)) return { tool: "stock_status", input: { only_low: true } };
  if (/\b(stock|inventory|maal)\b/.test(text)) return { tool: "stock_status", input: {} };
  if (/(top|best|most).{0,20}(buyer|customer|part(y|ies))/.test(text)) return { tool: "top_buyers", input: { period } };
  if (/(top|best|most).{0,20}(sell|product|item)|(product|item)s?.{0,20}(selling|sold) (the )?most/.test(text)) {
    return { tool: "top_products", input: { period } };
  }
  if (/\b(owes?|owed|outstanding|receivables?|overdue|dues?|udhaar|baki|collect|pending payments?)\b/.test(text)) {
    return { tool: "dues", input: {} };
  }
  if (/\bgst\b|\btax (payable|due|liability)\b/.test(text)) return { tool: "gst_estimate", input: { period } };
  if (/\b(profit|margin|earn(ed|ings)?|munafa|fayda)\b/.test(text)) return { tool: "profit_report", input: { period } };
  if (/\b(expenses?|spent|spending|kharcha)\b/.test(text)) return { tool: "expense_report", input: { period } };
  if (/\b(sales?|sold|revenue|turnover|bikri)\b/.test(text)) return { tool: "sales_report", input: { period } };
  if (/attention|today|overview|summary|to ?do|what should|how.{0,10}business/.test(text)) {
    return { tool: "business_overview", input: {} };
  }
  return null;
}

module.exports = { understand, parseBill, parseLine, EXAMPLES };
