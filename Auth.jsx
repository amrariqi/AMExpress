import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useApp } from '../lib/i18n';

export default function Auth() {
  const { t } = useApp();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none';
  const inputStyle = { borderWidth: 1, borderColor: 'var(--line)' };

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError(t('passwordTooShort')); return; }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: name || email.split('@')[0] } },
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(err.message || t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--paper)' }}>
      <form onSubmit={submit} className="bg-white rounded-2xl p-6 w-full max-w-sm border" style={{ borderColor: 'var(--line)', borderWidth: 1 }}>
        <h1 className="text-lg font-extrabold mb-5 text-center" style={{ color: 'var(--ink)' }}>
          {mode === 'signin' ? t('signIn') : t('signUp')}
        </h1>

        {mode === 'signup' && (
          <input className={inputCls} style={{ ...inputStyle, marginBottom: 12 }} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('name')} />
        )}
        <input className={inputCls} style={{ ...inputStyle, marginBottom: 12 }} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('email')} />
        <input className={inputCls} style={{ ...inputStyle, marginBottom: 12 }} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('password')} />

        {error && <div className="text-sm mb-3" style={{ color: 'var(--brick)' }}>{error}</div>}

        <button type="submit" disabled={busy} className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50" style={{ background: 'var(--brass)' }}>
          {mode === 'signin' ? t('signIn') : t('signUp')}
        </button>

        <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }} className="w-full mt-4 text-sm font-bold" style={{ color: 'var(--brass-dark)' }}>
          {mode === 'signin' ? t('newHere') : t('haveAccount')}
        </button>
      </form>
    </div>
  );
}
