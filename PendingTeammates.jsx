import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useApp } from '../lib/i18n';

export default function PendingTeammates({ companyId }) {
  const { t } = useApp();
  const [pending, setPending] = useState([]);
  const [roleChoice, setRoleChoice] = useState({});
  const [nameChoice, setNameChoice] = useState({});
  const [busyId, setBusyId] = useState(null);

  async function load() {
    const { data, error } = await supabase.rpc('pending_signups', { p_company_id: companyId });
    if (!error && data) setPending(data);
  }
  useEffect(() => { if (companyId) load(); }, [companyId]);

  async function approve(userId) {
    setBusyId(userId);
    const role = roleChoice[userId] || 'sales';
    const name = nameChoice[userId] || pending.find((p) => p.id === userId)?.email || '';
    const { error } = await supabase.rpc('approve_member', { p_company_id: companyId, p_user_id: userId, p_name: name, p_role: role });
    setBusyId(null);
    if (!error) load();
  }

  if (pending.length === 0) return null;

  const inputCls = 'px-2.5 py-1.5 rounded-lg border text-xs';
  const inputStyle = { borderWidth: 1, borderColor: 'var(--line)' };

  return (
    <div className="bg-white border rounded-2xl p-4 mb-4" style={{ borderColor: 'var(--line)', borderWidth: 1 }}>
      <div className="text-xs font-bold text-ink-soft mb-3">{t('pendingTeammates')}</div>
      <div className="space-y-2.5">
        {pending.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 border-b pb-2.5" style={{ borderColor: 'var(--line)' }}>
            <div className="text-sm font-bold flex-1 min-w-[120px]">{p.email}</div>
            <input
              className={inputCls} style={inputStyle} placeholder={t('name')}
              value={nameChoice[p.id] || ''} onChange={(e) => setNameChoice((s) => ({ ...s, [p.id]: e.target.value }))}
            />
            <select className={inputCls} style={inputStyle} value={roleChoice[p.id] || 'sales'} onChange={(e) => setRoleChoice((s) => ({ ...s, [p.id]: e.target.value }))}>
              <option value="accountant">{t('roleAccountant')}</option>
              <option value="sales">{t('roleSales')}</option>
              <option value="viewer">{t('roleViewer')}</option>
            </select>
            <button
              onClick={() => approve(p.id)} disabled={busyId === p.id}
              className="px-3 py-1.5 rounded-lg text-white text-xs font-bold disabled:opacity-50" style={{ background: 'var(--brass)' }}
            >
              {t('approve')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
