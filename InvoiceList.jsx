import { useEffect, useState } from 'react';
import { Loader2, Search, Eye, Pencil, Trash2, Copy, CheckCircle2, Circle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useApp } from '../lib/i18n';
import { calcInvoiceTotals, formatMoney, invoiceStatus, daysOverdue, todayStr } from '../lib/helpers';
import InvoicePrintView from './InvoicePrintView';

const STATUS_COLOR = { paid: 'var(--teal)', overdue: 'var(--brick)', dueSoon: 'var(--brass-dark)', open: 'var(--ink-soft)' };

export default function InvoiceList({ perms, companyId, company, customers, onEditInvoice }) {
  const { t } = useApp();
  const [rows, setRows] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewing, setViewing] = useState(null);

  async function load() {
    const { data } = await supabase.from('invoices').select('*').eq('company_id', companyId).order('date', { ascending: false });
    setRows(data || []);
  }
  useEffect(() => { if (companyId) load(); }, [companyId]);

  const customerById = Object.fromEntries(customers.map((c) => [c.id, c]));

  const filtered = (rows || []).filter((inv) => {
    const cust = customerById[inv.customer_id];
    const matchesQuery = inv.number.toLowerCase().includes(query.toLowerCase()) || (cust?.name || '').toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoiceStatus(inv) === statusFilter;
    return matchesQuery && matchesStatus;
  });

  async function togglePaid(inv) {
    await supabase.from('invoices').update({ is_paid: !inv.is_paid }).eq('id', inv.id);
    load();
  }
  async function remove(id) {
    if (!confirm(t('confirmDelete'))) return;
    await supabase.from('invoices').delete().eq('id', id);
    load();
  }
  async function duplicate(inv) {
    const { id, created_at, created_by, number, is_paid, ...rest } = inv;
    const { data: newNumber, error } = await supabase.rpc('next_invoice_number', { p_company_id: companyId });
    if (error) return;
    await supabase.from('invoices').insert({ ...rest, number: newNumber, is_paid: false, date: todayStr(), company_id: companyId });
    load();
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm';
  const inputStyle = { borderWidth: 1, borderColor: 'var(--line)' };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2" style={{ insetInlineStart: 10, color: 'var(--ink-soft)' }} />
          <input className={inputCls} style={{ ...inputStyle, paddingInlineStart: 32 }} placeholder={t('searchInvoices')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="text-xs font-bold px-2 py-2 rounded-lg border shrink-0" style={inputStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">{t('allStatuses')}</option>
          <option value="open">{t('statusOpen')}</option>
          <option value="dueSoon">{t('dueSoon')}</option>
          <option value="overdue">{t('overdue')}</option>
          <option value="paid">{t('paid')}</option>
        </select>
      </div>

      {rows === null ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin" size={22} style={{ color: 'var(--ink-soft)' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-ink-soft bg-white border rounded-xl p-6 text-center" style={{ borderColor: 'var(--line)', borderWidth: 1 }}>{t('noInvoices')}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => {
            const cust = customerById[inv.customer_id];
            const totals = calcInvoiceTotals(inv.items, inv.tax_percent, inv.discount);
            const status = invoiceStatus(inv);
            return (
              <div key={inv.id} className="bg-white border rounded-xl p-3.5" style={{ borderColor: 'var(--line)', borderWidth: 1 }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <button onClick={() => perms.canCreate && togglePaid(inv)} title={inv.is_paid ? t('markUnpaid') : t('markPaid')}>
                    {inv.is_paid ? <CheckCircle2 size={18} style={{ color: 'var(--teal)' }} /> : <Circle size={18} style={{ color: 'var(--ink-soft)' }} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{inv.number} · {cust?.name || '—'}</div>
                    <div className="text-xs" style={{ color: STATUS_COLOR[status] }}>
                      {t(status === 'open' ? 'statusOpen' : status)}
                      {status === 'overdue' && ` · ${daysOverdue(inv.due_date)} ${t('daysOverdue')}`}
                    </div>
                  </div>
                  <div className="text-sm font-extrabold tabular shrink-0">{formatMoney(totals.total, cust?.currency)}</div>
                </div>
                <div className="flex gap-1.5 justify-end pt-1.5 border-t" style={{ borderColor: 'var(--line)' }}>
                  <button onClick={() => setViewing(inv)} className="p-1.5 rounded-lg" style={{ border: '1px solid var(--line)' }}><Eye size={13} /></button>
                  {perms.canCreate && <button onClick={() => onEditInvoice(inv)} className="p-1.5 rounded-lg" style={{ border: '1px solid var(--line)' }}><Pencil size={13} /></button>}
                  {perms.canCreate && <button onClick={() => duplicate(inv)} className="p-1.5 rounded-lg" style={{ border: '1px solid var(--line)' }}><Copy size={13} /></button>}
                  {perms.canDelete && <button onClick={() => remove(inv.id)} className="p-1.5 rounded-lg" style={{ border: '1px solid var(--line)', color: 'var(--brick)' }}><Trash2 size={13} /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewing && (
        <InvoicePrintView invoice={viewing} customer={customerById[viewing.customer_id]} company={company} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
