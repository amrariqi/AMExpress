import { useEffect, useState } from 'react';
import { X, Printer } from 'lucide-react';
import QRCode from 'qrcode';
import { useApp } from '../lib/i18n';
import { calcInvoiceTotals, formatMoney } from '../lib/helpers';

export default function InvoicePrintView({ invoice, customer, company, onClose }) {
  const { t, isRTL } = useApp();
  const [qr, setQr] = useState('');
  const totals = calcInvoiceTotals(invoice.items, invoice.tax_percent, invoice.discount);
  const currency = customer?.currency || 'USD';

  useEffect(() => {
    const payload = company?.payment_link || `${invoice.number} | ${formatMoney(totals.total, currency)}`;
    QRCode.toDataURL(payload, { margin: 1, width: 160 }).then(setQr).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id]);

  const hasTrade = invoice.incoterm || invoice.port_of_loading || invoice.port_of_discharge || invoice.shipping_ref || invoice.country_of_origin;
  const hasBank = company?.bank_name || company?.bank_iban || company?.bank_swift;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-6 print:p-0 print:static" style={{ background: 'rgba(22,35,58,0.5)' }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-print-area, #invoice-print-area * { visibility: visible; }
          #invoice-print-area { position: absolute; inset: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="bg-white rounded-2xl w-full max-w-xl my-4 print:rounded-none print:my-0 print:max-w-full" style={{ border: '1px solid var(--line)' }}>
        <div className="flex items-center justify-between p-3 border-b no-print" style={{ borderColor: 'var(--line)' }}>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: 'var(--teal)' }}>
            <Printer size={14} /> {t('printInvoice')}
          </button>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div id="invoice-print-area" className="p-6" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="flex justify-between items-start mb-5 pb-4 border-b" style={{ borderColor: 'var(--line)' }}>
            <div>
              <div className="text-lg font-extrabold" style={{ color: 'var(--brass-dark)' }}>{company?.name || '—'}</div>
              <div className="text-xs text-ink-soft whitespace-pre-line">{company?.address}</div>
              <div className="text-xs text-ink-soft">{[company?.phone, company?.email].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="text-end">
              <div className="text-xl font-extrabold tabular">{invoice.number}</div>
              <div className="text-xs text-ink-soft">{invoice.date}</div>
              {invoice.due_date && <div className="text-xs text-ink-soft">{t('dueDate')}: {invoice.due_date}</div>}
            </div>
          </div>

          <div className="mb-5">
            <div className="text-xs font-bold text-ink-soft mb-1">{t('invoiceTo')}</div>
            <div className="font-bold text-sm">{customer?.name || '—'}</div>
            <div className="text-xs text-ink-soft">{[customer?.phone, customer?.email].filter(Boolean).join(' · ')}</div>
          </div>

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b text-xs text-ink-soft" style={{ borderColor: 'var(--line)' }}>
                <th className="text-start py-1.5">{t('description')}</th>
                <th className="text-end py-1.5">{t('qty')}</th>
                <th className="text-end py-1.5">{t('price')}</th>
                <th className="text-end py-1.5">{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).map((it, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--line)' }}>
                  <td className="py-1.5">{it.desc}{it.hsCode ? <span className="text-xs text-ink-soft"> · HS {it.hsCode}</span> : ''}</td>
                  <td className="text-end py-1.5 tabular">{it.qty}</td>
                  <td className="text-end py-1.5 tabular">{formatMoney(it.price)}</td>
                  <td className="text-end py-1.5 tabular">{formatMoney((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-5">
            <div className="w-48 space-y-1">
              <div className="flex justify-between text-sm text-ink-soft"><span>{t('subtotal')}</span><span className="tabular">{formatMoney(totals.subtotal, currency)}</span></div>
              <div className="flex justify-between text-sm text-ink-soft"><span>{t('tax')}</span><span className="tabular">{formatMoney(totals.tax, currency)}</span></div>
              <div className="flex justify-between text-sm text-ink-soft"><span>{t('discount')}</span><span className="tabular">-{formatMoney(totals.discount, currency)}</span></div>
              <div className="flex justify-between text-base font-extrabold pt-1 border-t" style={{ borderColor: 'var(--line)' }}><span>{t('total')}</span><span className="tabular">{formatMoney(totals.total, currency)}</span></div>
            </div>
          </div>

          {hasTrade && (
            <div className="mb-4 text-xs border rounded-xl p-3" style={{ borderColor: 'var(--line)' }}>
              <div className="font-bold text-ink-soft mb-1.5">{t('tradeDetails')}</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {invoice.incoterm && <div><span className="text-ink-soft">{t('incoterm')}: </span>{invoice.incoterm}</div>}
                {invoice.country_of_origin && <div><span className="text-ink-soft">{t('countryOfOrigin')}: </span>{invoice.country_of_origin}</div>}
                {invoice.port_of_loading && <div><span className="text-ink-soft">{t('portOfLoading')}: </span>{invoice.port_of_loading}</div>}
                {invoice.port_of_discharge && <div><span className="text-ink-soft">{t('portOfDischarge')}: </span>{invoice.port_of_discharge}</div>}
                {invoice.shipping_ref && <div className="col-span-2"><span className="text-ink-soft">{t('shippingRef')}: </span>{invoice.shipping_ref}</div>}
              </div>
            </div>
          )}

          <div className="flex items-end justify-between gap-4">
            {hasBank ? (
              <div className="text-xs flex-1">
                <div className="font-bold text-ink-soft mb-1">{t('bankDetails')}</div>
                {company.bank_name && <div>{t('bankName')}: {company.bank_name}</div>}
                {company.bank_beneficiary && <div>{t('beneficiary')}: {company.bank_beneficiary}</div>}
                {company.bank_account && <div>{t('bankAccount')}: {company.bank_account}</div>}
                {company.bank_iban && <div>{t('iban')}: {company.bank_iban}</div>}
                {company.bank_swift && <div>{t('swift')}: {company.bank_swift}</div>}
              </div>
            ) : <div className="flex-1" />}
            {qr && (
              <div className="text-center shrink-0">
                <img src={qr} alt="QR" width={80} height={80} />
                <div className="text-xs text-ink-soft mt-0.5">{t('scanToPay')}</div>
              </div>
            )}
          </div>

          {invoice.notes && <div className="text-xs text-ink-soft mt-4 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>{invoice.notes}</div>}
        </div>
      </div>
    </div>
  );
}
