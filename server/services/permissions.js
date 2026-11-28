// What each kind of login may do. Owners may do everything. For everyone else
// a request is refused unless a rule here allows it, so a new route stays
// private to the owner until someone decides otherwise.

const ROLES = ["owner", "staff", "accountant"];
const ID = "[a-f0-9]{24}";
const rule = (methods, pattern) => [methods.split(" "), new RegExp(`^/api/${pattern}$`)];

// Every signed-in person
const SHARED = [
  rule("GET", "auth/(me|supplier-info)"),
  rule("PUT", "auth/(password|mobile)"),
  rule("GET", "subscriptions/me"),
  rule("GET", "insights"),
  rule("GET", "data/search"),
  rule("GET", "assistant/status"),
  rule("POST", "assistant/chat"),
];

// Billing staff: make bills and take money, but not edit, cancel or delete
// them, and see nothing about costs, purchases or profit
const STAFF = [
  rule("GET POST", `buyers(/${ID})?`),
  rule("PUT", `buyers/${ID}`),
  rule("GET POST", `items(/${ID})?`),
  rule("GET", `invoices(/stats|/next-number|/${ID})?`),
  rule("PUT", `invoices/${ID}/compliance`),
  rule("POST", "invoices"),
  rule("POST", `invoices/${ID}/payment`),
  rule("GET", `quotations(/${ID})?`),
  rule("POST", "quotations"),
  rule("PUT", `quotations/${ID}(/status)?`),
  rule("POST", `quotations/${ID}/convert`),
  rule("GET", `credit-notes(/${ID})?`),
  rule("GET", `ledger/buyer/${ID}(/context)?`),
  rule("POST", `ledger/buyer/${ID}/receive`),
  rule("POST", "assistant/confirm"),
];

// An accountant reads the books and changes nothing
const ACCOUNTANT = [[["GET"], /^\/api\/(?!(team|activity)(\/|$)).+$/]];

const BY_ROLE = { staff: STAFF, accountant: ACCOUNTANT };

function allows(role, method, path) {
  if (role === "owner") return true;
  const clean = String(path).toLowerCase().replace(/\/+$/, "");
  const verb = method === "HEAD" ? "GET" : method;
  return [...SHARED, ...(BY_ROLE[role] || [])].some(
    ([methods, pattern]) => methods.includes(verb) && pattern.test(clean),
  );
}

// Assistant tools follow the same limits as the screens
const STAFF_TOOLS = [
  "sales_report", "top_products", "top_buyers", "dues",
  "draft_invoice", "draft_payment", "draft_buyer", "draft_product",
];

function canUseTool(role, name) {
  if (role === "owner") return true;
  if (role === "staff") return STAFF_TOOLS.includes(name);
  return role === "accountant" && !name.startsWith("draft_");
}

// What the screens should offer. Worked out from the rules above, so the two
// cannot disagree.
const ONE = "0123456789abcdef01234567";
const ABILITIES = {
  createInvoice: ["POST", "invoices"],
  editInvoice: ["PUT", `invoices/${ONE}`],
  recordPayment: ["POST", `invoices/${ONE}/payment`],
  returns: ["POST", "credit-notes"],
  deleteInvoice: ["DELETE", `invoices/${ONE}`],
  compliance: ["PUT", `invoices/${ONE}/compliance`],
  invoiceHistory: ["GET", `invoices/${ONE}/history`],
  createQuotation: ["POST", "quotations"],
  deleteQuotation: ["DELETE", `quotations/${ONE}`],
  addBuyer: ["POST", "buyers"],
  editBuyer: ["PUT", `buyers/${ONE}`],
  deleteBuyer: ["DELETE", `buyers/${ONE}`],
  sellers: ["GET", "sellers"],
  editSellers: ["POST", "sellers"],
  addItem: ["POST", "items"],
  editItem: ["PUT", `items/${ONE}`],
  purchases: ["GET", "purchases"],
  editPurchases: ["POST", "purchases"],
  expenses: ["GET", "expenses"],
  editExpenses: ["POST", "expenses"],
  stock: ["GET", "stock"],
  adjustStock: ["POST", "stock/adjust"],
  reports: ["GET", "reports/summary"],
  export: ["GET", "data/export"],
  import: ["POST", "data/import/items"],
  settings: ["PUT", "auth/supplier-info"],
  plans: ["POST", "subscriptions/create-order"],
  team: ["GET", "team"],
  workers: ["GET", "workers"],
  editWorkers: ["POST", "workers"],
};

const abilities = (role) =>
  Object.fromEntries(
    Object.entries(ABILITIES).map(([name, [method, path]]) => [name, allows(role, method, `/api/${path}`)]),
  );

// Set on the business record by the sign-in check
const roleOf = (user) => user?.$locals?.role || "owner";

module.exports = { ROLES, allows, abilities, canUseTool, roleOf };
