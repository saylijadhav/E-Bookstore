import { useStore } from "../store";

export default function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  const tone = { success: "border-emerald-500", error: "border-red-500", info: "border-sky-500" }[toast.tone];
  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-md border-l-4 ${tone} bg-ink-800 px-4 py-3 text-sm text-white shadow-xl`}
    >
      {toast.message}
    </div>
  );
}
