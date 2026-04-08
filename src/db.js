const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data.json');

const defaultDb = {
  counters: {
    users: 0,
    blogs: 0,
    comments: 0,
  },
  users: [],
  blogs: [],
  reactions: [],
  ratings: [],
  comments: [],
};

function loadDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
    return JSON.parse(JSON.stringify(defaultDb));
  }

  const raw = fs.readFileSync(dbPath, 'utf-8');
  const parsed = JSON.parse(raw || '{}');
  return {
    ...defaultDb,
    ...parsed,
    counters: { ...defaultDb.counters, ...(parsed.counters || {}) },
    users: parsed.users || [],
    blogs: parsed.blogs || [],
    reactions: parsed.reactions || [],
    ratings: parsed.ratings || [],
    comments: parsed.comments || [],
  };
}

let state = loadDb();

function persist() {
  fs.writeFileSync(dbPath, JSON.stringify(state, null, 2));
}

function nextId(key) {
  state.counters[key] += 1;
  return state.counters[key];
}

function now() {
  return new Date().toISOString();
}

module.exports = {
  now,
  findUserById: (id) => state.users.find((u) => u.id === id),
  findUserByUserIdOrEmail: (userId, email) =>
    state.users.find((u) => u.user_id === userId || u.email === email),
  createUser: ({ user_id, email, password_hash }) => {
    const user = { id: nextId('users'), user_id, email, password_hash, created_at: now() };
    state.users.push(user);
    persist();
    return user;
  },
  createBlog: ({ author_id, title, content, image_path }) => {
    const blog = { id: nextId('blogs'), author_id, title, content, image_path, created_at: now() };
    state.blogs.push(blog);
    persist();
    return blog;
  },
  findBlogById: (id) => state.blogs.find((b) => b.id === id),
  listBlogs: () => [...state.blogs].sort((a, b) => b.created_at.localeCompare(a.created_at)),
  upsertReaction: ({ blog_id, user_id, type }) => {
    const existing = state.reactions.find((r) => r.blog_id === blog_id && r.user_id === user_id);
    if (existing) {
      existing.type = type;
      existing.created_at = now();
    } else {
      state.reactions.push({ blog_id, user_id, type, created_at: now() });
    }
    persist();
  },
  upsertRating: ({ blog_id, user_id, rating }) => {
    const existing = state.ratings.find((r) => r.blog_id === blog_id && r.user_id === user_id);
    if (existing) {
      existing.rating = rating;
      existing.created_at = now();
    } else {
      state.ratings.push({ blog_id, user_id, rating, created_at: now() });
    }
    persist();
  },
  addComment: ({ blog_id, user_id, comment }) => {
    const newComment = { id: nextId('comments'), blog_id, user_id, comment, created_at: now() };
    state.comments.push(newComment);
    persist();
    return newComment;
  },
  listCommentsByBlogId: (blog_id) =>
    state.comments
      .filter((c) => c.blog_id === blog_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  getBlogStats: (blog_id) => {
    const likes = state.reactions.filter((r) => r.blog_id === blog_id && r.type === 'like').length;
    const dislikes = state.reactions.filter((r) => r.blog_id === blog_id && r.type === 'dislike').length;
    const commentsCount = state.comments.filter((c) => c.blog_id === blog_id).length;
    const blogRatings = state.ratings.filter((r) => r.blog_id === blog_id).map((r) => r.rating);
    const averageRating = blogRatings.length
      ? (blogRatings.reduce((sum, value) => sum + value, 0) / blogRatings.length).toFixed(2)
      : null;
    return { likes, dislikes, commentsCount, averageRating };
  },
};
