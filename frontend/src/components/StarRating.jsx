const Star = ({ fill }) => (
  <span className="relative inline-block h-4 w-4" aria-hidden="true">
    <svg viewBox="0 0 20 20" className="absolute inset-0 h-4 w-4 fill-ink-600">
      <path d="M10 1.5l2.6 5.5 6 .8-4.4 4.2 1.1 6L10 15.1 4.7 18l1.1-6L1.4 7.8l6-.8L10 1.5z" />
    </svg>
    <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
      <svg viewBox="0 0 20 20" className="h-4 w-4 fill-amber-400">
        <path d="M10 1.5l2.6 5.5 6 .8-4.4 4.2 1.1 6L10 15.1 4.7 18l1.1-6L1.4 7.8l6-.8L10 1.5z" />
      </svg>
    </span>
  </span>
);

export default function StarRating({ value, reviews, showValue = true }) {
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={`Rated ${value} out of 5`}>
      <div className="flex">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} fill={Math.max(0, Math.min(1, value - i))} />
        ))}
      </div>
      {showValue && <span className="text-sm font-medium text-slate-200">{value.toFixed(1)}</span>}
      {reviews != null && <span className="text-xs text-slate-400">({reviews.toLocaleString("en-IN")})</span>}
    </div>
  );
}
