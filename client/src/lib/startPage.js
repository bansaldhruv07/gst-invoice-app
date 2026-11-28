// Where the app opens: the new invoice screen, so a bill can be made at once.
// A login that may not make invoices gets the list of them.
export const startPage = (user) => (user?.can && !user.can.createInvoice ? "/invoices" : "/invoices/create");
