import crypto from "node:crypto";
import argon2 from "argon2";

const PUBLISHERS = ["Penguin Random House", "HarperCollins", "Bloomsbury", "Rupa Publications", "Westland Books", "Self Published"];

// [name, bio]
const AUTHORS = [
  ["Arjun Patel", "Arjun Patel writes about deep work, focus and building a life of intention."],
  ["Raj Patel", "Raj Patel is a learning-science writer who teaches mindset and method for lifelong learners."],
  ["James Wright", "James Wright is a motivational author and speaker on clarity, discipline and success."],
  ["James Adams", "James Adams writes atmospheric psychological thrillers and horror."],
  ["Jessica Martin", "Jessica Martin is a romance novelist known for heartfelt, character-driven stories."],
  ["Laura Mitchell", "Laura Mitchell writes science fiction about courage and humanity among the stars."],
  ["Daniel Reed", "Daniel Reed is a minimalism advocate who writes about living with less."],
  ["Clara Nelson", "Clara Nelson writes gothic mysteries set in quiet, haunted houses."],
  ["Emily Parker", "Emily Parker is a children's author whose stories celebrate friendship and kindness."],
  ["James Clear", "James Clear is a writer and speaker focused on habits, decision making, and continuous improvement."],
  ["Frank Herbert", "Frank Herbert (1920–1986) was an American author best known for the Dune saga."],
  ["Yuval Noah Harari", "Yuval Noah Harari is a historian and professor at the Hebrew University of Jerusalem."],
  ["Jane Austen", "Jane Austen (1775–1817) is among the most widely read English novelists."],
  ["J.R.R. Tolkien", "J.R.R. Tolkien was an English author and professor of Anglo-Saxon at Oxford."],
  ["A.P.J. Abdul Kalam", "Dr. A.P.J. Abdul Kalam was an aerospace scientist and the 11th President of India."],
  ["Sane Guruji", "Sane Guruji (Pandurang Sadashiv Sane) was a Marathi writer and social reformer."],
  ["Munshi Premchand", "Munshi Premchand (1880–1936) was one of the foremost Hindi–Urdu writers."],
  ["Carl Sagan", "Carl Sagan was an astronomer, planetary scientist and science communicator."],
  ["Marcus Aurelius", "Marcus Aurelius was Roman emperor from 161 to 180 AD and a Stoic philosopher."],
  ["Samin Nosrat", "Samin Nosrat is a chef, writer and host of the Netflix series Salt Fat Acid Heat."],
  ["Rabindranath Tagore", "Rabindranath Tagore (1861–1941) was a Bengali poet and polymath, and the first non-European to win the Nobel Prize in Literature."],
  ["Eknath Easwaran", "Eknath Easwaran (1910–1999) was a spiritual teacher and author known for his accessible translations of Indian scriptures."],
  ["Gabriel Wyner", "Gabriel Wyner is a polyglot and former opera singer who teaches how to learn languages quickly and for life."],
  ["Bill Bryson", "Bill Bryson is a best-selling author of humorous travel writing and popular science."],
  ["Suzanne Collins", "Suzanne Collins is an American author best known for the Hunger Games trilogy."],
  ["Art Spiegelman", "Art Spiegelman is an American cartoonist and the first graphic novelist to win a Pulitzer Prize."],
];

// title, author, category slug, publisher, tags, language, format, price, stock, deliveryDays, daysOld, description
const BOOKS = [
  ["The Art of Focus", "Arjun Patel", "self-help", "Penguin Random House", ["Non-fiction", "Self-help"], "English", "paperback", 399, 40, 4, 120, "Practical guide to mastering focus and boosting productivity every day."],
  ["The Art of Learning", "Raj Patel", "self-help", "Penguin Random House", ["Non-fiction", "Self-help"], "English", "paperback", 259, 35, 4, 100, "Master the mindset and methods for effective lifelong learning."],
  ["The Path to Success", "James Wright", "self-help", "HarperCollins", ["Non-fiction", "Self-help"], "English", "paperback", 359, 30, 4, 90, "A practical guide to achieving goals with clarity and confidence."],
  ["The Midnight Hour", "James Adams", "mystery", "HarperCollins", ["Fiction", "Thriller", "Horror"], "English", "paperback", 299, 25, 4, 60, "Haunting tale of a man's journey in the shadows of a forgotten past."],
  ["Beneath the Stars", "Jessica Martin", "romance", "Bloomsbury", ["Fiction", "Love", "Drama"], "English", "hardcover", 499, 20, 5, 45, "A heartwarming tale, where two souls discover who you need."],
  ["The Final Frontier", "Laura Mitchell", "science-fiction", "Westland Books", ["Fiction", "Thriller"], "English", "paperback", 359, 22, 4, 30, "A mission to space uncovers secrets to challenge humanity forever."],
  ["Joy of Minimalism", "Daniel Reed", "self-help", "Self Published", ["Non-fiction", "Self-help"], "English", "paperback", 149, 50, 3, 12, "Declutter your life to uncover peace, clarity, and joy."],
  ["The Vanishing House", "Clara Nelson", "mystery", "Bloomsbury", ["Fiction", "Horror"], "English", "ebook", 99, 0, 0, 8, "A chilling mystery unfolds within a house that disappears."],
  ["The Lost Kitten", "Emily Parker", "childrens", "Rupa Publications", ["Fiction", "Children"], "English", "hardcover", 339, 18, 5, 4, "A heartwarming tale of courage, friendship, and feline adventure."],
  ["Atomic Habits", "James Clear", "self-help", "Penguin Random House", ["Non-fiction", "Self-help"], "English", "paperback", 149, 80, 4, 200, "A practical framework for building good habits and breaking bad ones."],
  ["Dune", "Frank Herbert", "science-fiction", "Penguin Random House", ["Fiction", "Classic"], "English", "hardcover", 549, 15, 5, 300, "Politics, religion and ecology collide on the desert planet Arrakis."],
  ["Sapiens", "Yuval Noah Harari", "historical", "Penguin Random House", ["Non-fiction", "History"], "English", "ebook", 199, 0, 0, 250, "A brief history of humankind, from the Stone Age to the age of AI."],
  ["Pride and Prejudice", "Jane Austen", "romance", "Penguin Random House", ["Fiction", "Classic"], "English", "paperback", 129, 60, 4, 400, "Elizabeth Bennet and Mr. Darcy navigate manners and misjudgement."],
  ["The Hobbit", "J.R.R. Tolkien", "fantasy", "HarperCollins", ["Fiction", "Classic"], "English", "paperback", 349, 45, 4, 380, "Bilbo Baggins is swept into a quest to reclaim a dwarf kingdom from Smaug."],
  ["Wings of Fire", "A.P.J. Abdul Kalam", "biography", "Rupa Publications", ["Non-fiction", "Autobiography"], "English", "paperback", 175, 55, 4, 330, "The autobiography of India's Missile Man and 11th President."],
  ["Shyamchi Aai", "Sane Guruji", "memoir", "Rupa Publications", ["Classic", "Memoir"], "Marathi", "paperback", 110, 30, 5, 500, "A tender, much-loved Marathi memoir about a boy and his mother."],
  ["Godaan", "Munshi Premchand", "drama", "Rupa Publications", ["Classic", "Fiction"], "Hindi", "paperback", 99, 30, 5, 520, "Premchand's last completed novel, a portrait of rural India."],
  ["Cosmos", "Carl Sagan", "science", "Penguin Random House", ["Non-fiction", "Science"], "English", "ebook", 249, 0, 0, 280, "A journey through the universe and the history of scientific discovery."],
  ["Meditations", "Marcus Aurelius", "philosophy", "Penguin Random House", ["Classic", "Philosophy"], "English", "paperback", 189, 40, 4, 350, "Private reflections of a Roman emperor on Stoic practice."],
  ["Salt Fat Acid Heat", "Samin Nosrat", "cooking", "Bloomsbury", ["Non-fiction", "Cooking"], "English", "hardcover", 799, 12, 6, 150, "Master the elements of good cooking and learn to cook without a recipe."],
  // One title for each of the remaining genres so no genre page is empty. Appended last: seeded review text is picked by index.
  ["Gitanjali", "Rabindranath Tagore", "poetry", "Rupa Publications", ["Poetry", "Classic"], "English", "paperback", 149, 40, 4, 420, "Tagore's Nobel Prize-winning collection of devotional songs and verse."],
  ["The Bhagavad Gita", "Eknath Easwaran", "religion", "Penguin Random House", ["Non-fiction", "Religion"], "English", "paperback", 299, 35, 4, 410, "A clear, contemporary translation of the Gita's dialogue on duty, action and the self."],
  ["Fluent Forever", "Gabriel Wyner", "language-learning", "Bloomsbury", ["Non-fiction", "Language"], "English", "paperback", 449, 28, 4, 400, "How to learn any language fast and never forget it."],
  ["A Walk in the Woods", "Bill Bryson", "travel", "Penguin Random House", ["Non-fiction", "Travel"], "English", "paperback", 349, 30, 4, 390, "A funny, affectionate account of hiking the Appalachian Trail."],
  ["The Hunger Games", "Suzanne Collins", "young-adult", "Bloomsbury", ["Fiction", "Young Adult"], "English", "paperback", 399, 45, 4, 380, "Katniss Everdeen volunteers to take her sister's place in a televised fight to the death."],
  ["Maus", "Art Spiegelman", "comics-graphic-novels", "Penguin Random House", ["Graphic Novel", "Non-fiction"], "English", "paperback", 599, 20, 5, 370, "The Pulitzer Prize-winning graphic memoir of a Holocaust survivor and his son."],
];

// Cover art served by the frontend from /covers (frontend/public/covers). Titles without one fall back to a generated cover.
const COVERS = {
  "The Art of Focus": "/covers/the-art-of-focus.svg",
  "The Art of Learning": "/covers/the-art-of-learning.svg",
  "The Path to Success": "/covers/the-path-to-success.svg",
  "The Midnight Hour": "/covers/the-midnight-hour.svg",
  "Beneath the Stars": "/covers/beneath-the-stars.svg",
  "The Final Frontier": "/covers/the-final-frontier.svg",
  "Joy of Minimalism": "/covers/joy-of-minimalism.svg",
  "The Vanishing House": "/covers/the-vanishing-house.svg",
  "The Lost Kitten": "/covers/the-lost-kitten.svg",
};

const REVIEW_TEXT = [
  [5, "Clear, practical and easy to apply. Highly recommended."],
  [4, "Great read, though a few chapters felt repetitive."],
  [5, "Delivered quickly and in perfect condition."],
  [4, "Well written and engaging from start to finish."],
  [3, "Decent, but I expected a bit more depth."],
  [5, "One of the best books I have read this year."],
];

export async function seed(db, { withDemoUser = true, demoPassword } = {}) {
  await db.query("DELETE FROM sessions");
  await db.query("DELETE FROM order_items");
  await db.query("DELETE FROM orders");
  await db.query("DELETE FROM shipping_addresses");
  await db.query("DELETE FROM cart_items");
  await db.query("DELETE FROM wishlist_items");
  await db.query("DELETE FROM followed_authors");
  await db.query("DELETE FROM reviews");
  await db.query("DELETE FROM books");
  await db.query("DELETE FROM authors");
  await db.query("DELETE FROM publishers");
  await db.query("DELETE FROM coupons");
  await db.query("DELETE FROM users");

  const publisherId = {};
  for (const name of PUBLISHERS) {
    publisherId[name] = (await db.query("INSERT INTO publishers (name) VALUES ($1) RETURNING id", [name])).rows[0].id;
  }
  const authorId = {};
  for (const [name, bio] of AUTHORS) {
    authorId[name] = (await db.query("INSERT INTO authors (name, bio) VALUES ($1,$2) RETURNING id", [name, bio])).rows[0].id;
  }
  const categoryId = Object.fromEntries((await db.query("SELECT id, slug FROM categories")).rows.map((r) => [r.slug, r.id]));

  const bookIds = [];
  for (const [title, author, cat, pub, tags, lang, format, price, stock, days, daysOld, desc] of BOOKS) {
    const { rows } = await db.query(
      `INSERT INTO books (title, author_id, category_id, publisher_id, tags, description, language, format, price, stock, delivery_days, created_at, cover_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now() - make_interval(days => $12), $13) RETURNING id`,
      [title, authorId[author], categoryId[cat], publisherId[pub], tags, desc, lang, format, price, stock, days, daysOld, COVERS[title] ?? null],
    );
    bookIds.push(rows[0].id);
  }

  await db.query("INSERT INTO coupons (code, discount_percent) VALUES ('BOOKWORM10', 10), ('WELCOME20', 20)");

  // Reviewer accounts exist only to own seed reviews; their password is random and discarded, so nobody can log in as them.
  const reviewerHash = await argon2.hash(crypto.randomBytes(32).toString("hex"), { type: argon2.argon2id });
  const reviewers = [];
  for (const name of ["Aarav M.", "Priya S.", "Rohan K.", "Neha T."]) {
    const { rows } = await db.query(
      "INSERT INTO users (email, password_hash, full_name) VALUES ($1,$2,$3) RETURNING id",
      [`${name.replace(/\W/g, "").toLowerCase()}@seed.invalid`, reviewerHash, name],
    );
    reviewers.push(rows[0].id);
  }
  for (let i = 0; i < bookIds.length; i++) {
    for (let j = 0; j < reviewers.length; j++) {
      const [rating, body] = REVIEW_TEXT[(i + j) % REVIEW_TEXT.length];
      await db.query("INSERT INTO reviews (book_id, user_id, rating, body) VALUES ($1,$2,$3,$4)", [
        bookIds[i], reviewers[j], rating, body,
      ]);
    }
  }

  if (withDemoUser && demoPassword) {
    const hash = await argon2.hash(demoPassword, { type: argon2.argon2id });
    await db.query(
      "INSERT INTO users (email, password_hash, full_name, gift_points) VALUES ('demo@bookworm.test',$1,'Demo Reader',250)",
      [hash],
    );
  }
  return { bookIds, authorId };
}
