import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useStore } from "../store";

const field =
  "w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-slate-200 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

const EyeIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {!open && <path d="M4 4l16 16" />}
  </svg>
);

export default function Auth({ mode }) {
  const isRegister = mode === "register";
  const { setUser, refresh, notify } = useStore();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setFields({});
    try {
      const body = isRegister ? form : { email: form.email, password: form.password };
      const { user } = await (isRegister ? api.register(body) : api.login(body));
      setUser(user);
      await refresh().catch(() => {});
      notify(isRegister ? "Welcome to E-Bookstore! 100 gift points added." : `Welcome back, ${user.fullName}`, "success");
      navigate(state?.from ?? "/", { replace: true });
    } catch (err) {
      setError(err.message);
      setFields(err.fields ?? {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-lg border border-ink-700 bg-ink-900 p-8">
        <h1 className="text-2xl font-bold text-white">{isRegister ? "Create your account" : "Sign in"}</h1>

        {isRegister && (
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
            Full name
            <input className={field} value={form.fullName} onChange={set("fullName")} autoComplete="name" maxLength={100} required />
            {fields.fullName && <span className="text-red-400">{fields.fullName}</span>}
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
          Email
          <input className={field} type="email" value={form.email} onChange={set("email")} autoComplete="email" maxLength={100} required />
          {fields.email && <span className="text-red-400">{fields.email}</span>}
        </label>
        <div className="flex flex-col gap-1 text-xs font-medium text-slate-400">
          <label htmlFor="password">Password</label>
          <div className="relative">
            <input
              id="password"
              className={`${field} pr-11`}
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={set("password")}
              autoComplete={isRegister ? "new-password" : "current-password"}
              maxLength={128}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-3 text-slate-400 hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
          {isRegister && <span className="text-slate-500">At least 10 characters.</span>}
          {fields.password && <span className="text-red-400">{fields.password}</span>}
        </div>

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        <button type="submit" disabled={busy} className="rounded-md bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50">
          {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
        </button>
        <p className="text-sm text-slate-400">
          {isRegister ? (
            <>Already a member? <Link to="/login" state={state} className="text-sky-400 hover:underline">Sign in</Link></>
          ) : (
            <>New here? <Link to="/register" state={state} className="text-sky-400 hover:underline">Create an account</Link> and get 100 gift points.</>
          )}
        </p>
        <p className="text-xs text-slate-500">Browsing and your cart work as a guest; sign in to pay.</p>
      </form>
    </div>
  );
}
