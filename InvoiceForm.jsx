import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useApp } from '../lib/i18n';
import { calcInvoiceTotals, formatMoney, nextInvoiceNumber, todayStr } from '../lib/helpers';

let rowSeq = 0;
function newRow() { return { key: 'r' + (rowSeq++), desc: '', qty: 1, price: 0, catalogId: '', hsCode: '' }; }

export default function InvoiceForm({ companyId, customers, catalogItems, company, editingInvoice, presetCustomerId, onDone, onCancel }) {
  const { t } = useApp();
  const isEdit = !!editingInvoice;
  const [customerId, setCustomerId] = useState(editingInvoice?.customer_id || presetCustomerId || '');
  const [date, setDate] = useState(editingInvoice?.date || todayStr());
  const [dueDate, setDueDate] = useState(editingInvoice?.due_date || '');
  const [items, setItems] = useState(
    editingInvoice?.items?.length
      ? editingInvoice.items.map((it) => ({ key: 'r' + (rowSeq++), desc: it.desc || '', qty: it.qty ?? 1, price: it.price ?? 0, catalogId: it.catalogId || '', hsCode: it.hsCode || '' }))
      : [newRow()]
  );
  const [taxPercent, setTaxPercent] = useState(editingInvoice?.tax_percent ?? company?.tax_default ?? 0);
  const [discount, setDiscount] = useState(editingInvoice?.discount ?? 0);
  const [notes, setNotes] = useState(editingInvoice?.notes || '');
  const [showTrade, setShowTrade] = useState(!!(editingInvoice?.incoterm || editingInvoice?.port_of_loading || editingInvoice?.shipping_ref));
  const [incoterm, setIncoterm] = useState(editingInvoice?.incoterm || '');
  const [portOfLoading, setPortOfLoading] = useState(editingInvoice?.port_of_loading || '');
  const [portOfDischarge, setPortOfDischarge] = useState(editingInvoice?.port_of_discharge || '');
  const [shippingRef, setShippingRef] = useState(editingInvoice?.shipping_ref || '');
  const [countryOfOrigin, setCountryOfOrigin] = useState(editingInvoice?.country_of_origin || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const totals = calcInvoiceTotals(items, taxPercent, discount);
  const customer = customers.find((c) => c.id === customerId);
  const currency = customer?.currency || 'USD';
  const previewNumber = isEdit ? editingInvoice.number : nextInvoiceNumber(company?.invoice_prefix, company?.next_number);

  function updateItem(key, patch) {
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function pickCatalog(key, catalogId) {
    const item = catalogItems.find((c) => c.id === catalogId);
    updateItem(key, { catalogId, desc: item ? item.name : '', price: item ? item.price : 0 });
  }
  function removeItem(key) {
    setItems((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  async function save() {
    if (!customerId) { setErr(t('selectCustomer')); return; }
    const cleanItems = items.filter((r) => r.desc.trim());
    if (cleanItems.length === 0) { setErr(t('required')); return; }
    setSaving(true); setErr('');
    const payload = {
      number: previewNumber,
      customer_id: customerId,
      date,
      due_date: dueDate || null,
      items: cleanItems.map(({ desc, qty, price, catalogId, hsCode }) => ({
        desc, qty: Number(qty) || 0, price: Number(price) || 0, catalogId: catalogId || null, hsCode: hsCode || null,
      })),
      tax_percent: Number(taxPercent) || 0,
      discount: Number(discount) || 0,
      notes: notes || null,
      company_id: companyId,
      incoterm: incoterm || null,
      port_of_loading: portOfLoading || null,
      port_of_discharge: portOfDischarge || null,
      shipping_ref: shippingRef || null,
      country_of_origin: countryOfOrigin || null,
    };
    if (!isEdit) {
      const { data: assigned, error: numErr } = await supabase.rpc('next_invoice_number', { p_company_id: companyId });
      if (numErr) { setSaving(false); setErr(numErr.message); return; }
      payload.number = assigned;
    }
    const req = isEdit
      ? supabase.from('invoices').update(payload).eq('id', editingInvoice.id)
      : supabase.from('invoices').insert(payload);
    const { error } = await req;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onDone();
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm';
  const inputStyle = { borderWidth: 1, borderColor: 'var(--line)' };
  const labelCls = 'text-xs font-bold text-ink-soft mb-1 block';
  const card = { borderColor: 'var(--line)', borderWidth: 1 };

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between mb-4">
        <div className="font-extrabold text-lg">{isEdit ? t('editInvoice') : t('newInvoice')}</div>
        <div className="text-sm font-bold tabular" style={{ color: 'var(--brass-dark)' }}>{previewNumber}</div>
      </div>

      <div className="bg-white border rounded-2xl p-4 mb-3 space-y-3" style={card}>
        <div>
          <label className={labelCls}>{t('customer')}</label>
          <select className={inputCls} style={inputStyle} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">{t('selectCustomer')}</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.currency})</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('invoiceDate')}</label>
            <input type="date" className={inputCls} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{t('dueDate')}</label>
            <input type="date" className={inputCls} style={inputStyle} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-4 mb-3" style={card}>
        <div className="flex items-center justify-between mb-3">
          <div className={labelCls} style={{ marginBottom: 0 }}>{t('lineItems')}</div>
          <button onClick={() => setItems((r) => [...r, newRow()])} className="text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1" style={{ border: '1px solid var(--line)' }}>
            <Plus size={13} /> {t('addItem')}
          </button>
        </div>
        <div className="space-y-3">
          {items.map((row) => (
            <div key={row.key} className="border rounded-xl p-2.5" style={{ borderColor: 'var(--line)' }}>
              <div className="flex gap-2 mb-2">
                {catalogItems.length > 0 && (
                  <select className="text-xs px-2 py-1.5 rounded-lg border shrink-0" style={{ ...inputStyle, maxWidth: 110 }} value={row.catalogId} onChange={(e) => pickCatalog(row.key, e.target.value)}>
                    <option value="">{t('fromCatalog')}</option>
                    {catalogItems.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                <input className={inputCls} style={inputStyle} placeholder={t('description')} value={row.desc} onChange={(e) => updateItem(row.key, { desc: e.target.value })} />
                <button onClick={() => removeItem(row.key)} className="p-2 rounded-lg shrink-0" style={{ color: 'var(--brick)' }}><Trash2 size={15} /></button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" min="0" className={inputCls} style={inputStyle} placeholder={t('qty')} value={row.qty} onChange={(e) => updateItem(row.key, { qty: e.target.value })} />
                <input type="number" min="0" step="0.01" className={inputCls} style={inputStyle} placeholder={t('price')} value={row.price} onChange={(e) => updateItem(row.key, { price: e.target.value })} />
                <div className="flex items-center justify-end text-sm font-bold tabular px-1">{formatMoney((Number(row.qty) || 0) * (Number(row.price) || 0))}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-4 mb-3" style={card}>
        <button onClick={() => setShowTrade((s) => !s)} className="flex items-center justify-between w-full text-xs font-bold text-ink-soft">
          {t('tradeDetails')} {showTrade ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {showTrade && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div><label className={labelCls}>{t('incoterm')}</label><input className={inputCls} style={inputStyle} placeholder="FOB, CIF, DAP…" value={incoterm} onChange={(e) => setIncoterm(e.target.value)} /></div>
            <div><label className={labelCls}>{t('countryOfOrigin')}</label><input className={inputCls} style={inputStyle} value={countryOfOrigin} onChange={(e) => setCountryOfOrigin(e.target.value)} /></div>
            <div><label className={labelCls}>{t('portOfLoading')}</label><input className={inputCls} style={inputStyle} value={portOfLoading} onChange={(e) => setPortOfLoading(e.target.value)} /></div>
            <div><label className={labelCls}>{t('portOfDischarge')}</label><input className={inputCls} style={inputStyle} value={portOfDischarge} onChange={(e) => setPortOfDischarge(e.target.value)} /></div>
            <div className="col-span-2"><label className={labelCls}>{t('shippingRef')}</label><input className={inputCls} style={inputStyle} value={shippingRef} onChange={(e) => setShippingRef(e.target.value)} /></div>
          </div>
        )}
      </div>

      <div className="bg-white border rounded-2xl p-4 mb-3 space-y-3" style={card}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>{t('tax')}</label><input type="number" min="0" className={inputCls} style={inputStyle} value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} /></div>
          <div><label className={labelCls}>{t('discount')}</label><input type="number" min="0" className={inputCls} style={inputStyle} value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
        </div>
        <div>
          <label className={labelCls}>{t('notes')}</label>
          <textarea className={inputCls} style={inputStyle} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="pt-2 border-t space-y-1" style={{ borderColor: 'var(--line)' }}>
          <div className="flex justify-between text-sm text-ink-soft"><span>{t('subtotal')}</span><span className="tabular">{formatMoney(totals.subtotal, currency)}</span></div>
          <div className="flex justify-between text-sm text-ink-soft"><span>{t('tax')}</span><span className="tabular">{formatMoney(totals.tax, currency)}</span></div>
          <div className="flex justify-between text-sm text-ink-soft"><span>{t('discount')}</span><span className="tabular">-{formatMoney(totals.discount, currency)}</span></div>
          <div className="flex justify-between text-base font-extrabold pt-1"><span>{t('total')}</span><span className="tabular">{formatMoney(totals.total, currency)}</span></div>
        </div>
      </div>

      {err && <div className="text-sm mb-3" style={{ color: 'var(--brick)' }}>{err}</div>}

      <div className="fixed bottom-0 inset-x-0 bg-white border-t p-3 flex gap-2 max-w-3xl mx-auto" style={{ borderColor: 'var(--line)' }}>
        <button onClick={onCancel} className="flex-1 py-3 rounded-lg font-bold text-sm" style={{ border: '1px solid var(--line)' }}>{t('cancel')}</button>
        <button onClick={save} disabled={saving} className="flex-1 py-3 rounded-lg font-bold text-sm text-white disabled:opacity-50" style={{ background: 'var(--teal)' }}>{t('save')}</button>
      </div>
    </div>
  );
}
