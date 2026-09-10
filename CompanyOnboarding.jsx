import { useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useApp } from '../lib/i18n';

export default function CompanyOnboarding({ onCreated, onCancel }) {
  const { t } = useApp();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function create() {
    if (!name.trim()) return;
    setSaving(true); setErr('');
    const { data, error } = await supabase.rpc('create_company', { p_name: name.trim() });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onCreated(data);
  }

  return (
    <div className="bg-white border rounded-2xl p-6 w-full max-w-sm text-center mx-4" style={{ borderColor: 'var(--line)', borderWidth: 1 }}>
      <Building2 size={30} className="mx-auto mb-3" style={{ color: 'var(--brass-dark)' }} />
      <div className="font-extrabold text-lg mb-1">{t('createCompanyTitle')}</div>
      <div className="text-sm text-ink-soft mb-4">{t('createCompanyDesc')}</div>
      <input
        className="w-full px-3 py-2.5 rounded-lg border text-sm mb-3 text-center" style={{ borderColor: 'var(--line)', borderWidth: 1 }}
        placeholder={t('companyName')} value={name} onChange={(e) => setName(e.target.value)} autoFocus
        onKeyDown={(e) => e.key === 'Enter' && create()}
      />
      {err && <div className="text-sm mb-3" style={{ color: 'var(--brick)' }}>{err}</div>}
      <button onClick={create} disabled={saving || !name.trim()} className="w-full py-2.5 rounded-lg font-bold text-white disabled:opacity-50 flex items-center justify-center" style={{ background: 'var(--teal)' }}>
        {saving ? <Loader2 className="animate-spin" size={16} /> : t('createCompany')}
      </button>
      {onCancel ? (
        <button onClick={onCancel} className="text-xs text-ink-soft mt-3 underline">{t('cancel')}</button>
      ) : (
        <div className="text-xs text-ink-soft mt-4">{t('orWaitingInvite')}</div>
      )}
    </div>
  );
}
