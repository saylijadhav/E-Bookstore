import { useState } from "react";
import Modal from "./Modal";
import { formatINR } from "../api";

// Tabs mirror the "Payment Screen" design. `method` is the only value ever sent to the API:
// card numbers, CVV, UPI ids etc. stay in this component's state and are discarded on close.
const TABS = [
  { id: "credit", label: "Credit Card", method: "card" },
  { id: "debit", label: "Debit Card", method: "card" },
  { id: "upi", label: "UPI", method: "upi" },
  { id: "wallet", label: "Wallet", method: "wallet" },
  { id: "netbanking", label: "Net Banking", method: "netbanking" },
  { id: "cod", label: "Cash on Delivery", method: "cod" },
];
const WALLETS = ["Paytm", "PhonePe", "Amazon Pay"];
const BANKS = ["State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank"];

const EMPTY = { number: "", name: "", cvv: "", expiry: "", upi: "", wallet: WALLETS[0], bank: BANKS[0] };

function luhn(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function validate(tab, v) {
  const e = {};
  if (tab === "credit" || tab === "debit") {
    const digits = v.number.replace(/\s/g, "");
    if (!/^\d{16}$/.test(digits) || !luhn(digits)) e.number = "Enter a valid 16-digit card number";
    if (!v.name.trim()) e.name = "Enter the name on the card";
    if (!/^\d{3,4}$/.test(v.cvv)) e.cvv = "Enter the 3 or 4 digit CVV";
    const m = /^(\d{2})\/(\d{2})$/.exec(v.expiry);
    const now = new Date();
    const expired = m && (2000 + Number(m[2]) < now.getFullYear() || (2000 + Number(m[2]) === now.getFullYear() && Number(m[1]) < now.getMonth() + 1));
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12 || expired) e.expiry = "Enter a valid future date (MM/YY)";
  } else if (tab === "upi" && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(v.upi.trim())) {
    e.upi = "Enter a valid UPI ID, e.g. name@bank";
  }
  return e;
}

const inputClass = (bad) =>
  `w-full rounded-md border bg-ink-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 ${
    bad ? "border-red-500 focus:ring-red-500" : "border-ink-600 focus:border-sky-500 focus:ring-sky-500"
  }`;

function Field({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      {children}
      {error && <p id={`${id}-err`} className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

export default function PaymentModal({ amount, busy, error, onClose, onPay }) {
  const [tab, setTab] = useState("credit");
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const set = (name, format = (x) => x) => (e) => {
    setV((s) => ({ ...s, [name]: format(e.target.value) }));
    if (errors[name]) setErrors((er) => ({ ...er, [name]: undefined }));
  };
  const fmtNumber = (x) => x.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
  const fmtExpiry = (x) => {
    const d = x.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = validate(tab, v);
    setErrors(errs);
    if (Object.keys(errs).length === 0) onPay(TABS.find((t) => t.id === tab).method);
  };

  const isCard = tab === "credit" || tab === "debit";

  return (
    <Modal labelledBy="payment-title" onClose={busy ? undefined : onClose} className="max-w-2xl">
      <form onSubmit={submit} noValidate>
        <header className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
          <h2 id="payment-title" className="text-base font-semibold text-white">Complete Payment</h2>
          <p className="text-sm text-slate-300">Payable Amount: <strong className="text-white">{formatINR(amount)}</strong></p>
        </header>

        <div className="grid sm:grid-cols-[11rem_1fr]">
          <div role="tablist" aria-label="Payment options" aria-orientation="vertical" className="flex border-b border-ink-700 bg-ink-800 sm:flex-col sm:border-b-0 sm:border-r">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="pay-panel"
                disabled={busy}
                onClick={() => { setTab(t.id); setErrors({}); }}
                className={`border-l-4 px-4 py-3 text-left text-sm ${tab === t.id ? "border-sky-500 bg-ink-900 font-semibold text-white" : "border-transparent text-slate-400 hover:text-white"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" id="pay-panel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-4 p-5">
            {isCard && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="cc-number" label="Card Number" error={errors.number}>
                  <input id="cc-number" value={v.number} onChange={set("number", fmtNumber)} inputMode="numeric" autoComplete="cc-number" placeholder="XXXX XXXX XXXX XXXX" aria-invalid={errors.number ? "true" : undefined} aria-describedby={errors.number ? "cc-number-err" : undefined} className={inputClass(errors.number)} />
                </Field>
                <Field id="cc-name" label="Name on Card" error={errors.name}>
                  <input id="cc-name" value={v.name} onChange={set("name")} maxLength={60} autoComplete="cc-name" placeholder="Name" aria-invalid={errors.name ? "true" : undefined} aria-describedby={errors.name ? "cc-name-err" : undefined} className={inputClass(errors.name)} />
                </Field>
                <Field id="cc-cvv" label="CVV" error={errors.cvv}>
                  <input id="cc-cvv" type="password" value={v.cvv} onChange={set("cvv", (x) => x.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="cc-csc" placeholder="XXX" aria-invalid={errors.cvv ? "true" : undefined} aria-describedby={errors.cvv ? "cc-cvv-err" : undefined} className={inputClass(errors.cvv)} />
                </Field>
                <Field id="cc-exp" label="Date of Expiry" error={errors.expiry}>
                  <input id="cc-exp" value={v.expiry} onChange={set("expiry", fmtExpiry)} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" aria-invalid={errors.expiry ? "true" : undefined} aria-describedby={errors.expiry ? "cc-exp-err" : undefined} className={inputClass(errors.expiry)} />
                </Field>
              </div>
            )}
            {tab === "upi" && (
              <Field id="upi-id" label="UPI ID" error={errors.upi}>
                <input id="upi-id" value={v.upi} onChange={set("upi")} maxLength={60} placeholder="name@bank" aria-invalid={errors.upi ? "true" : undefined} aria-describedby={errors.upi ? "upi-id-err" : undefined} className={inputClass(errors.upi)} />
              </Field>
            )}
            {tab === "wallet" && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-xs font-medium text-slate-400">Choose a wallet</legend>
                {WALLETS.map((w) => (
                  <label key={w} className="flex items-center gap-2 text-sm text-slate-200">
                    <input type="radio" name="wallet" checked={v.wallet === w} onChange={() => setV((s) => ({ ...s, wallet: w }))} /> {w}
                  </label>
                ))}
              </fieldset>
            )}
            {tab === "netbanking" && (
              <Field id="bank" label="Bank">
                <select id="bank" value={v.bank} onChange={set("bank")} className={inputClass(false)}>
                  {BANKS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </Field>
            )}
            {tab === "cod" && <p className="text-sm text-slate-300">Pay in cash when your order arrives. The order stays pending until delivery.</p>}

            <p className="text-xs text-slate-500">Demo store: no real payment is taken. Payment details stay in your browser and are never sent or stored.</p>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

            <div className="mt-auto flex items-center justify-end gap-3">
              <button type="button" onClick={onClose} disabled={busy} className="rounded-md px-4 py-2 text-sm text-slate-300 hover:underline disabled:opacity-40">Cancel</button>
              <button type="submit" disabled={busy} className="rounded-md bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? "Processing…" : "Pay Now"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
