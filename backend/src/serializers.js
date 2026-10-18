const PHYSICAL = new Set(["paperback", "hardcover"]);
export const isPhysical = (format) => PHYSICAL.has(format);
export const toPaise = (rupees) => Math.round(rupees * 100);

const pad = (n) => String(n).padStart(2, "0");

export function estimatedDelivery(days) {
  if (!days) return null; // 0 = instant download
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Shared SELECT for BookSummary. Callers append WHERE / ORDER BY / extra JOINs.
export function bookSelect(extraColumns = "") {
  return `
    SELECT b.id, b.title, b.category_id, b.tags, b.description, b.language, b.format, b.price, b.stock,
           b.delivery_days, b.cover_url, b.created_at,
           a.id AS author_id, a.name AS author_name,
           c.name AS category, c.slug AS category_slug,
           p.id AS publisher_id, p.name AS publisher,
           COALESCE(r.avg_rating, 0) AS rating, COALESCE(r.cnt, 0) AS review_count
           ${extraColumns ? `, ${extraColumns}` : ""}
    FROM books b
    JOIN authors a    ON a.id = b.author_id
    JOIN categories c ON c.id = b.category_id
    JOIN publishers p ON p.id = b.publisher_id
    LEFT JOIN (
      SELECT book_id, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*)::int AS cnt
      FROM reviews GROUP BY book_id
    ) r ON r.book_id = b.id`;
}

export function mapBook(r) {
  return {
    id: r.id,
    title: r.title,
    author: { id: r.author_id, name: r.author_name },
    category: r.category,
    categorySlug: r.category_slug,
    publisher: { id: r.publisher_id, name: r.publisher },
    tags: r.tags,
    description: r.description,
    language: r.language,
    format: r.format,
    price: r.price,
    rating: r.rating,
    reviewCount: r.review_count,
    coverUrl: r.cover_url,
    deliveryDays: r.delivery_days,
    estimatedDelivery: estimatedDelivery(r.delivery_days),
    inStock: isPhysical(r.format) ? r.stock > 0 : true,
  };
}
