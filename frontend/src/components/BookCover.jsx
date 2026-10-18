// Cover art is generated from the title until real images are uploaded (coverUrl).
const PALETTES = [
  ["#f59e0b", "#b45309"], ["#6366f1", "#312e81"], ["#10b981", "#064e3b"], ["#ec4899", "#831843"],
  ["#0ea5e9", "#0c4a6e"], ["#a855f7", "#3b0764"], ["#ef4444", "#7f1d1d"], ["#14b8a6", "#134e4a"],
  ["#facc15", "#a16207"], ["#64748b", "#1e293b"],
];

export default function BookCover({ book, className = "" }) {
  const base = `aspect-[2/3] overflow-hidden rounded-md shadow-lg ${className}`;
  if (book.coverUrl) {
    return <img src={book.coverUrl} alt={`Cover of ${book.title}`} className={`${base} object-cover`} loading="lazy" />;
  }
  const [from, to] = PALETTES[book.id % PALETTES.length];
  return (
    <div
      role="img"
      aria-label={`Cover of ${book.title}`}
      className={`${base} flex flex-col justify-between p-4 text-white`}
      style={{ backgroundImage: `linear-gradient(145deg, ${from}, ${to})` }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest opacity-80">{book.category}</span>
      <span className="text-lg font-extrabold leading-tight">{book.title}</span>
      <span className="text-xs font-medium opacity-90">{book.author.name}</span>
    </div>
  );
}
