import { useEffect, useState } from 'react';
import { Loader2, Plus, Search, Trash2, X, Pencil, FileText } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useApp } from '../lib/i18n';

const CURRENCIES = ['USD', 'CNY', 'SAR', 'AED', 'EUR', 'GBP'];

export default function Customers({ perms, companyId, onNewInvoiceFor }) {
  const { t } = useApp();
  const [rows, setRows] = useState(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null); // null closed, {} new, {...} edit
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('customers').select('*').eq('company_id', companyId).order('name');
    setRows(data || []);
  }
  useEffect(() => { if (companyId) load(); }, [companyId]);

  async function save() {
    if (!editing.name?.trim()) return;
    setSaving(true);
    const payload = {
      name: editing.name.trim(),
      phone: editing.phone || null,
      email: editing.email || null,
      notes: editing.notes || null,
      currency: editing.currency || 'USD',
      company_id: companyId,
    };
    const req = editing.id
      ? supabase.from('customers').update(payload).eq('id', editing.id)
      : supabase.from('customers').insert(payload);
    const { error } = await req;
    setSaving(false);
    if (!error) { setEditing(null); load(); }
  }

  async function remove(id) {
    if (!confirm(t('confirmDelete'))) return;
    await supabase.from('customers').delete().eq('id', id);
    load();
  }

  const filtered = (rows || []).filter(
    (c) => c.name.toLowerCase().includes(query.toLowerCase()) || (c.phone || '').includes(query)
  );

  const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm';
  const inputStyle = { borderWidth: 1, borderColor: 'var(--line)' };
  const labelCls = 'text-xs font-bold text-ink-soft mb-1 block';

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2" style={{ insetInlineStart: 10, color: 'var(--ink-soft)' }} />
          <input
            className={inputCls} style={{ ...inputStyle, paddingInlineStart: 32 }}
            placeholder={t('searchCustomers')} value={query} onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {perms.canCreate && (
          <button onClick={() => setEditing({ currency: 'USD' })} className="p-2.5 rounded-lg text-white shrink-0" style={{ background: 'var(--teal)' }}>
            <Plus size={18} />
          </button>
        )}
      </div>

      {rows === null ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin" size={22} style={{ color: 'var(--ink-soft)' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-ink-soft bg-white border rounded-xl p-6 text-center" style={{ borderColor: 'var(--line)', borderWidth: 1 }}>{t('noCustomers')}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.id} className="bg-white border rounded-xl p-3.5 flex items-center gap-2" style={{ borderColor: 'var(--line)', borderWidth: 1 }}>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{c.name}</div>
                <div className="text-xs text-ink-soft truncate">{[c.phone, c.currency].filter(Boolean).join(' · ')}</div>
              </div>
              {onNewInvoiceFor && perms.canCreate && (
                <button onClick={() => onNewInvoiceFor(c)} className="p-2 rounded-lg shrink-0" style={{ border: '1px solid var(--line)', color: 'var(--teal)' }} title={t('newInvoice')}>
                  <FileText size={14} />
                </button>
              )}
              <button onClick={() => setEditing(c)} className="p-2 rounded-lg shrink-0" style={{ border: '1px solid var(--line)' }}><Pencil size={14} /></button>
              {perms.canDelete && (
                <button onClick={() => remove(c.id)} className="p-2 rounded-lg shrink-0" style={{ border: '1px solid var(--line)', color: 'var(--brick)' }}><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" style={{ background: 'rgba(22,35,58,0.4)' }} onClick={() => setEditing(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-extrabold">{editing.id ? t('editCustomer') : t('addCustomer')}</div>
              <button onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>{t('customerName')}</label>
                <input className={inputCls} style={inputStyle} value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('phone')}</label>
                  <input className={inputCls} style={inputStyle} value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>{t('currency')}</label>
                  <select className={inputCls} style={inputStyle} value={editing.currency || 'USD'} onChange={(e) => setEditing({ ...editing, currency: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('email')}</label>
                <input className={inputCls} style={inputStyle} value={editing.email || ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>{t('notes')}</label>
                <textarea className={inputCls} style={inputStyle} rows={2} value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-lg font-bold text-sm" style={{ border: '1px solid var(--line)' }}>{t('cancel')}</button>
              <button onClick={save} disabled={saving || !editing.name?.trim()} className="flex-1 py-2.5 rounded-lg font-bold text-sm text-white disabled:opacity-50" style={{ background: 'var(--teal)' }}>{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
