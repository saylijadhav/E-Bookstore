-- Book Worm — PostgreSQL schema
-- Apply as an admin role:  psql -d bookworm -v ON_ERROR_STOP=1 -f db/schema.sql
-- Then grant the app role: psql -d bookworm -v app_role=bookworm_app -f db/grants.sql
-- Money is NUMERIC(10,2) in INR. Passwords are Argon2id hashes only. Session tokens are stored hashed.

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------- enums
CREATE TYPE book_format    AS ENUM ('paperback', 'hardcover', 'ebook', 'audiobook');
CREATE TYPE user_role      AS ENUM ('customer', 'admin');
CREATE TYPE order_status   AS ENUM ('pending', 'paid', 'shipped', 'delivered', 'cancelled');
CREATE TYPE payment_method AS ENUM ('upi', 'card', 'netbanking', 'wallet', 'cod');

-- ---------------------------------------------------------------- users
-- A guest is a user row without credentials; registering upgrades the row in place so the cart
-- and orders are kept. gift_points: 1 point = INR 1 when redeemed.
CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         CITEXT       UNIQUE,
    password_hash TEXT,
    full_name     VARCHAR(100),
    is_guest      BOOLEAN      NOT NULL DEFAULT FALSE,
    role          user_role    NOT NULL DEFAULT 'customer',
    gift_points   INTEGER      NOT NULL DEFAULT 0 CHECK (gift_points >= 0),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (is_guest OR (email IS NOT NULL AND password_hash IS NOT NULL AND full_name IS NOT NULL))
);

-- ---------------------------------------------------------------- sessions (cookie holds the raw token; DB holds SHA-256)
CREATE TABLE sessions (
    token_hash CHAR(64)    PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx    ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

-- ---------------------------------------------------------------- authors ("writers")
CREATE TABLE authors (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       VARCHAR(120) NOT NULL,
    bio        TEXT         NOT NULL DEFAULT '',
    photo_url  TEXT,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX authors_name_trgm_idx ON authors USING GIN (name gin_trgm_ops);

-- ---------------------------------------------------------------- categories (genres)
CREATE TABLE categories (
    id   SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(60) NOT NULL UNIQUE,
    slug VARCHAR(60) NOT NULL UNIQUE
);

-- ---------------------------------------------------------------- publishers ("brands")
CREATE TABLE publishers (
    id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE
);

-- ---------------------------------------------------------------- books
CREATE TABLE books (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title         VARCHAR(255)  NOT NULL,
    author_id     BIGINT        NOT NULL REFERENCES authors (id)    ON DELETE RESTRICT,
    category_id   SMALLINT      NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
    publisher_id  INTEGER       NOT NULL REFERENCES publishers (id) ON DELETE RESTRICT,
    tags          TEXT[]        NOT NULL DEFAULT '{}',          -- display pills, e.g. {Non-fiction,Self-help}
    description   TEXT          NOT NULL DEFAULT '',
    language      VARCHAR(30)   NOT NULL DEFAULT 'English',
    format        book_format   NOT NULL,
    price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    stock         INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),   -- ignored for ebook/audiobook
    delivery_days SMALLINT      NOT NULL DEFAULT 5 CHECK (delivery_days >= 0),  -- 0 = instant
    cover_url     TEXT,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX books_category_idx  ON books (category_id);
CREATE INDEX books_author_idx    ON books (author_id);
CREATE INDEX books_publisher_idx ON books (publisher_id);
CREATE INDEX books_format_idx    ON books (format);
CREATE INDEX books_price_idx     ON books (price);
CREATE INDEX books_created_idx   ON books (created_at DESC);
CREATE INDEX books_title_trgm_idx ON books USING GIN (title gin_trgm_ops);

-- ---------------------------------------------------------------- reviews (star rating system)
CREATE TABLE reviews (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    book_id    BIGINT        NOT NULL REFERENCES books (id) ON DELETE CASCADE,
    user_id    BIGINT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    rating     SMALLINT      NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body       VARCHAR(1000) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (book_id, user_id)
);

-- ---------------------------------------------------------------- wishlist / followed writers
CREATE TABLE wishlist_items (
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    book_id    BIGINT      NOT NULL REFERENCES books (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, book_id)
);

CREATE TABLE followed_authors (
    user_id    BIGINT      NOT NULL REFERENCES users (id)   ON DELETE CASCADE,
    author_id  BIGINT      NOT NULL REFERENCES authors (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, author_id)
);

-- ---------------------------------------------------------------- cart (server-side, per user or guest)
CREATE TABLE cart_items (
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    book_id    BIGINT      NOT NULL REFERENCES books (id) ON DELETE CASCADE,
    quantity   INTEGER     NOT NULL CHECK (quantity BETWEEN 1 AND 20),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, book_id)
);

-- ---------------------------------------------------------------- coupons
CREATE TABLE coupons (
    code             VARCHAR(20) PRIMARY KEY CHECK (code = upper(code)),
    discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
    expires_at       TIMESTAMPTZ,
    active           BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------- shipping addresses
CREATE TABLE shipping_addresses (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    first_name    VARCHAR(50)  NOT NULL,
    last_name     VARCHAR(50)  NOT NULL,
    address_line  VARCHAR(200) NOT NULL,
    email         CITEXT       NOT NULL,
    city          VARCHAR(60)  NOT NULL,
    pin           CHAR(6)      NOT NULL CHECK (pin ~ '^[0-9]{6}$'),
    phone         CHAR(10)     NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
    state         VARCHAR(60)  NOT NULL,
    country       VARCHAR(60)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX shipping_addresses_user_idx ON shipping_addresses (user_id);

-- ---------------------------------------------------------------- orders
-- Totals are snapshotted at purchase time so later price/coupon/tax changes never alter history.
CREATE TABLE orders (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             BIGINT         NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    shipping_address_id BIGINT         NOT NULL REFERENCES shipping_addresses (id) ON DELETE RESTRICT,
    coupon_code         VARCHAR(20)    REFERENCES coupons (code),
    status              order_status   NOT NULL DEFAULT 'pending',
    payment_method      payment_method NOT NULL,
    subtotal            NUMERIC(10,2)  NOT NULL CHECK (subtotal >= 0),
    discount            NUMERIC(10,2)  NOT NULL DEFAULT 0 CHECK (discount >= 0),
    tax                 NUMERIC(10,2)  NOT NULL CHECK (tax >= 0),
    shipping_fee        NUMERIC(10,2)  NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
    points_redeemed     INTEGER        NOT NULL DEFAULT 0 CHECK (points_redeemed >= 0),
    points_earned       INTEGER        NOT NULL DEFAULT 0 CHECK (points_earned >= 0),
    total               NUMERIC(10,2)  NOT NULL CHECK (total >= 0),
    payment_reference   VARCHAR(100),
    idempotency_key     UUID           NOT NULL,
    estimated_delivery  DATE,
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    cancelled_at        TIMESTAMPTZ,
    refunded_at         TIMESTAMPTZ,
    CHECK (total = subtotal - discount + tax + shipping_fee - points_redeemed),
    UNIQUE (user_id, idempotency_key)
);
CREATE INDEX orders_user_idx ON orders (user_id, created_at DESC);

CREATE TABLE order_items (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id   BIGINT        NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    book_id    BIGINT        NOT NULL REFERENCES books (id) ON DELETE RESTRICT,
    quantity   INTEGER       NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),   -- price snapshot
    UNIQUE (order_id, book_id)
);

-- ---------------------------------------------------------------- seed: genre list from the UI
INSERT INTO categories (name, slug) VALUES
    ('Romance','romance'), ('Mystery','mystery'), ('Science Fiction','science-fiction'),
    ('Fantasy','fantasy'), ('Historical','historical'), ('Biography','biography'),
    ('Self-help','self-help'), ('Memoir','memoir'), ('Travel','travel'), ('Cooking','cooking'),
    ('Children''s','childrens'), ('Young Adult','young-adult'),
    ('Comics & Graphic Novels','comics-graphic-novels'), ('Poetry','poetry'), ('Drama','drama'),
    ('Science','science'), ('Philosophy','philosophy'), ('Religion','religion'),
    ('Language Learning','language-learning');
-- "All" is a UI-only filter (no category param), so it is intentionally not a row.

COMMIT;
