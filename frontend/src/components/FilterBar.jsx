const LANGUAGES = ["English", "Hindi", "Marathi"];
const FORMATS = [
  ["paperback", "Paperback"],
  ["hardcover", "Hard Cover"],
  ["ebook", "eBook"],
  ["audiobook", "Audiobook"],
];
const PRICE_RANGES = [
  ["", "Any price"],
  ["0-200", "Under ₹200"],
  ["200-400", "₹200 – ₹400"],
  ["400-", "Over ₹400"],
];
const SORTS = [
  ["relevance", "Relevance"],
  ["price_asc", "Price: Low to High"],
  ["price_desc", "Price: High to Low"],
  ["rating", "Top Rated"],
];

const field =
  "w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-slate-200 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

function Select({ label, value, onChange, options, any = "All" }) {
  return (
    <label className="flex min-w-36 flex-col gap-1 text-xs font-medium text-slate-400">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={field}>
        {any !== null && <option value="">{any}</option>}
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </label>
  );
}

// Controlled by URL search params so filters survive reload, back/forward and sharing.
export default function FilterBar({ params, onChange }) {
  const get = (k) => params.get(k) ?? "";
  const price = `${get("minPrice")}-${get("maxPrice")}`;

  const setPrice = (v) => {
    const [min, max] = v.split("-");
    onChange({ minPrice: min || "", maxPrice: max || "" });
  };

  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-700 bg-ink-900 p-4">
      <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs font-medium text-slate-400">
        Search
        <input
          type="search"
          value={get("q")}
          onChange={(e) => onChange({ q: e.target.value })}
          maxLength={100}
          placeholder="Search by title or author"
          className={field}
        />
      </label>
      <Select label="Language" value={get("language")} onChange={(v) => onChange({ language: v })} options={LANGUAGES} />
      <Select label="Format (Paperback, eBook, etc.)" value={get("format")} onChange={(v) => onChange({ format: v })} options={FORMATS} />
      <Select label="Price Range" value={price === "-" ? "" : price} onChange={setPrice} options={PRICE_RANGES.slice(1)} any="Any price" />
      <Select label="Sort by" value={get("sort") || "relevance"} onChange={(v) => onChange({ sort: v })} options={SORTS} any={null} />
    </form>
  );
}
