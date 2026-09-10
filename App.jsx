import { useEffect, useState } from 'react';
import { Loader2, LogOut, LayoutDashboard, Users, FileText, Building2, ChevronDown, Plus, Check } from 'lucide-react';
import { supabase } from './supabaseClient';
import { AppContext, makeT } from './lib/i18n';
import { formatMoney, invoiceStatus } from './lib/helpers';
import Auth from './components/Auth';
import CompanyOnboarding from './components/CompanyOnboarding';
import PendingTeammates from './components/PendingTeammates';
import Customers from './components/Customers';
import InvoiceList from './components/InvoiceList';
import InvoiceForm from './components/InvoiceForm';

const ROLES = {
  owner: { canCreate: true, canDelete: true, canViewSettings: true },
  accountant: { canCreate: true, canDelete: true, canViewSettings: false },
  sales: { canCreate: true, canDelete: false, canViewSettings: false },
  viewer: { canCreate: false, canDelete: false, canViewSettings: false },
};

const ACTIVE_COMPANY_KEY = 'invoicing_active_company_id';

export default function App() {
  const [lang, setLang] = useState('ar');
  const [session, setSession] = useState(undefined);       // undefined = checking, null = signed out
  const [memberships, setMemberships] = useState(undefined); // undefined = loading, [] = none yet
  const [activeCompanyId, setActiveCompanyId] = useState(() => {
    try { return localStorage.getItem(ACTIVE_COMPANY_KEY) || ''; } catch { return ''; }
  });
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const [view, setView] = useState('dashboard'); // dashboard | customers | invoices | invoiceForm | newCompany
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [presetCustomerId, setPresetCustomerId] = useState('');
  const [customers, setCustomers] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const t = makeT(lang);
  const isRTL = lang === 'ar';

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadMemberships() {
    const { data, error } = await supabase
      .from('company_members')
      .select('company_id, role, name, companies(*)')
      .eq('user_id', session.user.id);
    if (error) { setLoadError(error.message); setMemberships([]); return; }
    setMemberships(data || []);
  }

  useEffect(() => {
    if (session === undefined) return;
    if (!session) { setMemberships(null); return; }
    loadMemberships();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Keep the active company valid once memberships load / change.
  useEffect(() => {
    if (!memberships || memberships.length === 0) return;
    const stillValid = memberships.some((m) => m.company_id === activeCompanyId);
    if (!stillValid) {
      const first = memberships[0].company_id;
      setActiveCompanyId(first);
      try { localStorage.setItem(ACTIVE_COMPANY_KEY, first); } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberships]);

  function switchCompany(id) {
    setActiveCompanyId(id);
    try { localStorage.setItem(ACTIVE_COMPANY_KEY, id); } catch { /* ignore */ }
    setShowCompanyMenu(false);
    setView('dashboard');
    setRefreshKey((k) => k + 1);
  }

  async function onCompanyCreated(id) {
    await loadMemberships();
    switchCompany(id);
  }

  const activeMembership = (memberships || []).find((m) => m.company_id === activeCompanyId);
  const company = activeMembership?.companies || null;
  const perms = activeMembership ? (ROLES[activeMembership.role] || ROLES.viewer) : ROLES.viewer;

  // Reference data every screen needs, scoped to the active company.
  useEffect(() => {
    if (!activeCompanyId) return;
    (async () => {
      const [{ data: custs }, { data: items }] = await Promise.all([
        supabase.from('customers').select('*').eq('company_id', activeCompanyId).order('name'),
        supabase.from('catalog_items').select('*').eq('company_id', activeCompanyId).order('name'),
      ]);
      setCustomers(custs || []);
      setCatalogItems(items || []);
    })();
  }, [activeCompanyId, refreshKey]);

  useEffect(() => {
    if (!activeCompanyId) return;
    (async () => {
      try {
        const [{ count: customerCount }, { data: invoices }] = await Promise.all([
          supabase.from('customers').select('id', { count: 'exact', head: true }).eq('company_id', activeCompanyId),
          supabase.from('invoices').select('items,tax_percent,discount,is_paid,customer_id,due_date').eq('company_id', activeCompanyId),
        ]);
        const { data: payments } = await supabase.from('payments').select('customer_id,amount').eq('company_id', activeCompanyId);
        const { data: customersForCurrency } = await supabase.from('customers').select('id,currency').eq('company_id', activeCompanyId);
        const currencyById = Object.fromEntries((customersForCurrency || []).map((c) => [c.id, c.currency || 'USD']));

        const balances = {};
        (invoices || []).forEach((inv) => {
          const subtotal = (inv.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
          const tax = subtotal * (Number(inv.tax_percent) || 0) / 100;
          const total = Math.max(0, subtotal + tax - (Number(inv.discount) || 0));
          const cur = currencyById[inv.customer_id] || 'USD';
          balances[inv.customer_id] = balances[inv.customer_id] || {};
          balances[inv.customer_id][cur] = (balances[inv.customer_id][cur] || 0) + total;
        });
        (payments || []).forEach((p) => {
          const cur = currencyById[p.customer_id] || 'USD';
          balances[p.customer_id] = balances[p.customer_id] || {};
          balances[p.customer_id][cur] = (balances[p.customer_id][cur] || 0) - (Number(p.amount) || 0);
        });

        const totalsByCurrency = {};
        Object.values(balances).forEach((byCur) => {
          Object.entries(byCur).forEach(([cur, bal]) => {
            if (!totalsByCurrency[cur]) totalsByCurrency[cur] = { receivable: 0, payable: 0 };
            if (bal > 0) totalsByCurrency[cur].receivable += bal; else totalsByCurrency[cur].payable += -bal;
          });
        });

        const overdueCount = (invoices || []).filter((inv) => invoiceStatus(inv) === 'overdue').length;

        setDashboard({ customerCount: customerCount || 0, invoiceCount: (invoices || []).length, totalsByCurrency, overdueCount });
      } catch (e) {
        setLoadError(e.message);
      }
    })();
  }, [activeCompanyId, refreshKey]);

  function goNewInvoice(customerId) {
    setEditingInvoice(null);
    setPresetCustomerId(customerId || '');
    setView('invoiceForm');
  }
  function goEditInvoice(inv) {
    setEditingInvoice(inv);
    setPresetCustomerId('');
    setView('invoiceForm');
  }
  function onInvoiceSaved() {
    setView('invoices');
    setRefreshKey((k) => k + 1);
  }

  const NAV = [
    { key: 'dashboard', label: t('navDashboard'), icon: LayoutDashboard },
    { key: 'customers', label: t('navCustomers'), icon: Users },
    { key: 'invoices', label: t('navInvoices'), icon: FileText },
  ];
  const titleKey = { dashboard: 'navDashboard', customers: 'navCustomers', invoices: 'navInvoices', invoiceForm: 'navInvoices', newCompany: 'addCompany' }[view];
  const showNav = session && memberships && memberships.length > 0 && view !== 'invoiceForm';

  return (
    <AppContext.Provider value={{ t, lang, isRTL }}>
      <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
        <style>{`
          :root {
            --ink: #16233A; --ink-soft: #5B6B82; --paper: #EFF1F3; --brass: #B8863A;
            --brass-dark: #96702C; --teal: #2F6B5E; --brick: #A44A36; --line: #DADDE3;
          }
          .text-ink-soft { color: var(--ink-soft); }
          .tabular { font-variant-numeric: tabular-nums; }
        `}</style>

        {session === undefined || (session && memberships === undefined) ? (
          <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="animate-spin" size={28} style={{ color: 'var(--ink-soft)' }} />
          </div>
        ) : !session ? (
          <Auth />
        ) : memberships.length === 0 ? (
          <div className="min-h-screen flex items-center justify-center">
            <CompanyOnboarding onCreated={onCompanyCreated} />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 pb-24">
            <div className="flex items-center justify-between pt-5 pb-4">
              <div>
                <div className="text-sm text-ink-soft">{t('welcome')}, {activeMembership?.name}</div>
                <h1 className="text-xl font-extrabold">{t(titleKey)}</h1>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowCompanyMenu((s) => !s)}
                    className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-full max-w-[110px]"
                    style={{ background: 'white', border: '1px solid var(--line)' }}
                  >
                    <Building2 size={13} className="shrink-0" />
                    <span className="truncate">{company?.name}</span>
                    <ChevronDown size={13} className="shrink-0" />
                  </button>
                  {showCompanyMenu && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setShowCompanyMenu(false)} />
                      <div
                        className="absolute z-30 mt-1 bg-white border rounded-xl py-1 w-56 overflow-hidden"
                        style={{ borderColor: 'var(--line)', borderWidth: 1, insetInlineEnd: 0, boxShadow: '0 8px 24px rgba(22,35,58,0.15)' }}
                      >
                        <div className="px-3 pt-2 pb-1 text-xs font-bold text-ink-soft">{t('myCompanies')}</div>
                        {memberships.map((m) => (
                          <button
                            key={m.company_id} onClick={() => switchCompany(m.company_id)}
                            className="w-full text-start px-3 py-2 text-sm flex items-center justify-between gap-2"
                          >
                            <span className="truncate">{m.companies?.name}</span>
                            {m.company_id === activeCompanyId && <Check size={14} className="shrink-0" style={{ color: 'var(--teal)' }} />}
                          </button>
                        ))}
                        <div className="border-t mt-1" style={{ borderColor: 'var(--line)' }} />
                        <button
                          onClick={() => { setShowCompanyMenu(false); setView('newCompany'); }}
                          className="w-full text-start px-3 py-2 text-sm font-bold flex items-center gap-1.5"
                          style={{ color: 'var(--teal)' }}
                        >
                          <Plus size={14} /> {t('addCompany')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <select value={lang} onChange={(e) => setLang(e.target.value)} className="text-xs font-bold px-2 py-1.5 rounded-full" style={{ background: 'white', border: '1px solid var(--line)' }}>
                  <option value="ar">AR</option><option value="en">EN</option><option value="zh">中文</option>
                </select>
                <button onClick={() => supabase.auth.signOut()} className="p-2 rounded-full shrink-0" style={{ background: 'white', border: '1px solid var(--line)' }}>
                  <LogOut size={16} />
                </button>
              </div>
            </div>

            {view === 'dashboard' && perms.canViewSettings && <PendingTeammates companyId={activeCompanyId} />}
            {loadError && <div className="text-sm mb-4" style={{ color: 'var(--brick)' }}>{loadError}</div>}

            {view === 'dashboard' && (
              !dashboard ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin" size={22} style={{ color: 'var(--ink-soft)' }} /></div>
              ) : (
                <>
                  {Object.entries(dashboard.totalsByCurrency).length === 0 ? (
                    <div className="text-sm text-ink-soft bg-white border rounded-xl p-5 text-center mb-4" style={{ borderColor: 'var(--line)', borderWidth: 1 }}>—</div>
                  ) : Object.entries(dashboard.totalsByCurrency).map(([cur, v]) => (
                    <div key={cur} className="flex gap-3 flex-wrap mb-3">
                      <div className="bg-white border rounded-2xl p-4 flex-1" style={{ borderColor: 'var(--line)', borderWidth: 1, minWidth: 140 }}>
                        <div className="text-xs text-ink-soft mb-1">{t('totalReceivable')} ({cur})</div>
                        <div className="text-2xl font-extrabold tabular" style={{ color: 'var(--teal)' }}>{formatMoney(v.receivable, cur)}</div>
                      </div>
                      <div className="bg-white border rounded-2xl p-4 flex-1" style={{ borderColor: 'var(--line)', borderWidth: 1, minWidth: 140 }}>
                        <div className="text-xs text-ink-soft mb-1">{t('totalPayable')} ({cur})</div>
                        <div className="text-2xl font-extrabold tabular" style={{ color: 'var(--brick)' }}>{formatMoney(v.payable, cur)}</div>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3 flex-wrap mb-6">
                    <div className="bg-white border rounded-2xl p-4 flex-1" style={{ borderColor: 'var(--line)', borderWidth: 1, minWidth: 105 }}>
                      <div className="text-xs text-ink-soft mb-1">{t('customerCount')}</div>
                      <div className="text-2xl font-extrabold tabular">{dashboard.customerCount}</div>
                    </div>
                    <div className="bg-white border rounded-2xl p-4 flex-1" style={{ borderColor: 'var(--line)', borderWidth: 1, minWidth: 105 }}>
                      <div className="text-xs text-ink-soft mb-1">{t('invoiceCount')}</div>
                      <div className="text-2xl font-extrabold tabular">{dashboard.invoiceCount}</div>
                    </div>
                    <div className="bg-white border rounded-2xl p-4 flex-1" style={{ borderColor: dashboard.overdueCount ? 'var(--brick)' : 'var(--line)', borderWidth: 1, minWidth: 105 }}>
                      <div className="text-xs mb-1" style={{ color: dashboard.overdueCount ? 'var(--brick)' : 'var(--ink-soft)' }}>{t('overdue')}</div>
                      <div className="text-2xl font-extrabold tabular" style={{ color: dashboard.overdueCount ? 'var(--brick)' : 'inherit' }}>{dashboard.overdueCount}</div>
                    </div>
                  </div>
                  {perms.canCreate && (
                    <button onClick={() => goNewInvoice()} className="w-full py-3 rounded-xl font-bold text-white mb-4" style={{ background: 'var(--teal)' }}>
                      + {t('newInvoice')}
                    </button>
                  )}
                </>
              )
            )}

            {view === 'customers' && <Customers perms={perms} companyId={activeCompanyId} onNewInvoiceFor={(c) => goNewInvoice(c.id)} />}
            {view === 'invoices' && <InvoiceList perms={perms} companyId={activeCompanyId} company={company} customers={customers} onEditInvoice={goEditInvoice} />}
            {view === 'invoiceForm' && (
              <InvoiceForm
                companyId={activeCompanyId} customers={customers} catalogItems={catalogItems} company={company}
                editingInvoice={editingInvoice} presetCustomerId={presetCustomerId}
                onDone={onInvoiceSaved} onCancel={() => setView(editingInvoice ? 'invoices' : 'dashboard')}
              />
            )}
            {view === 'newCompany' && (
              <div className="flex items-center justify-center py-10">
                <CompanyOnboarding onCreated={onCompanyCreated} onCancel={() => setView('dashboard')} />
              </div>
            )}
          </div>
        )}

        {showNav && (
          <div className="fixed bottom-0 inset-x-0 bg-white border-t flex" style={{ borderColor: 'var(--line)' }}>
            <div className="max-w-3xl mx-auto w-full flex">
              {NAV.map(({ key, label, icon: Icon }) => (
                <button
                  key={key} onClick={() => setView(key)}
                  className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-bold"
                  style={{ color: view === key ? 'var(--teal)' : 'var(--ink-soft)' }}
                >
                  <Icon size={19} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}
