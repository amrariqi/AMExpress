export function formatMoney(amount, currency) {
  const n = Number(amount) || 0;
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${currency} ${formatted}` : formatted;
}

export function calcInvoiceTotals(items, taxPercent, discount) {
  const subtotal = (items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const tax = (subtotal * (Number(taxPercent) || 0)) / 100;
  const disc = Number(discount) || 0;
  const total = Math.max(0, subtotal + tax - disc);
  return { subtotal, tax, discount: disc, total };
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// paid > partial > overdue > dueSoon (within 3 days) > open.
// amountPaid comes from summed payment_allocations for this invoice, if the
// caller has that data; is_paid still works as a manual override/quick-mark.
export function invoiceStatus(inv, amountPaid = 0) {
  const { total } = calcInvoiceTotals(inv.items, inv.tax_percent, inv.discount);
  if (inv.is_paid || amountPaid >= total - 0.005) return 'paid';
  if (amountPaid > 0) return 'partial';
  if (!inv.due_date) return 'open';
  const today = todayStr();
  if (inv.due_date < today) return 'overdue';
  const diffDays = Math.round((new Date(inv.due_date) - new Date(today)) / 86400000);
  if (diffDays <= 3) return 'dueSoon';
  return 'open';
}

export function daysOverdue(dueDate) {
  const diff = Math.floor((new Date(todayStr()) - new Date(dueDate)) / 86400000);
  return diff > 0 ? diff : 0;
}

export function nextInvoiceNumber(prefix, next) {
  return `${prefix || 'INV'}-${String(next || 1).padStart(4, '0')}`;
}
