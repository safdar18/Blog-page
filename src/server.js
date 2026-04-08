require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const db = require('./db');
const { generateToken, requireAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(uploadsDir));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    return cb(new Error('Only image uploads are allowed.'));
  },
});

function isValidUserId(userId) {
  return /^[a-zA-Z0-9_]{3,30}$/.test(userId);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/register', authLimiter, (req, res) => {
  const { userId, email, password } = req.body;

  if (!userId || !email || !password) {
    return res.status(400).json({ error: 'userId, email, and password are required.' });
  }

  if (!isValidUserId(userId)) {
    return res.status(400).json({ error: 'userId must be 3-30 chars, letters/numbers/underscore only.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const normalizedUserId = userId.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.findUserByUserIdOrEmail(normalizedUserId, normalizedEmail);
  if (existing) return res.status(409).json({ error: 'User ID or email already in use.' });

  const passwordHash = bcrypt.hashSync(password, 12);
  const user = db.createUser({ user_id: normalizedUserId, email: normalizedEmail, password_hash: passwordHash });

  const token = generateToken(user);

  return res.status(201).json({ token, user: { id: user.id, userId: user.user_id, email: user.email } });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { userIdOrEmail, password } = req.body;

  if (!userIdOrEmail || !password) {
    return res.status(400).json({ error: 'userIdOrEmail and password are required.' });
  }

  const normalized = userIdOrEmail.trim();
  const user = db.findUserByUserIdOrEmail(normalized, normalized.toLowerCase());

  if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });

  const token = generateToken(user);
  return res.json({ token, user: { id: user.id, userId: user.user_id, email: user.email } });
});

app.get('/api/blogs', (_req, res) => {
  const blogs = db.listBlogs().map((blog) => {
    const author = db.findUserById(blog.author_id);
    const stats = db.getBlogStats(blog.id);
    return {
      id: blog.id,
      title: blog.title,
      content: blog.content,
      imagePath: blog.image_path,
      createdAt: blog.created_at,
      authorUserId: author ? author.user_id : 'unknown',
      likes: stats.likes,
      dislikes: stats.dislikes,
      commentsCount: stats.commentsCount,
      averageRating: stats.averageRating,
    };
  });

  return res.json(blogs);
});

app.post('/api/blogs', requireAuth, upload.single('image'), (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required.' });
  }

  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  const blog = db.createBlog({ author_id: req.user.id, title: title.trim(), content: content.trim(), image_path: imagePath });

  return res.status(201).json({ id: blog.id, message: 'Blog created.' });
});

app.post('/api/blogs/:id/reaction', requireAuth, (req, res) => {
  const blogId = Number(req.params.id);
  const { type } = req.body;

  if (!['like', 'dislike'].includes(type)) {
    return res.status(400).json({ error: 'type must be like or dislike.' });
  }

  const blog = db.findBlogById(blogId);
  if (!blog) return res.status(404).json({ error: 'Blog not found.' });

  db.upsertReaction({ blog_id: blogId, user_id: req.user.id, type });
  return res.json({ message: `Reaction set to ${type}.` });
});

app.post('/api/blogs/:id/rating', requireAuth, (req, res) => {
  const blogId = Number(req.params.id);
  const rating = Number(req.body.rating);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be an integer between 1 and 5.' });
  }

  const blog = db.findBlogById(blogId);
  if (!blog) return res.status(404).json({ error: 'Blog not found.' });

  db.upsertRating({ blog_id: blogId, user_id: req.user.id, rating });
  return res.json({ message: 'Rating submitted.' });
});

app.get('/api/blogs/:id/comments', requireAuth, (req, res) => {
  const blogId = Number(req.params.id);
  const blog = db.findBlogById(blogId);
  if (!blog) return res.status(404).json({ error: 'Blog not found.' });

  const comments = db.listCommentsByBlogId(blogId).map((comment) => {
    const user = db.findUserById(comment.user_id);
    return {
      id: comment.id,
      comment: comment.comment,
      created_at: comment.created_at,
      user_id: user ? user.user_id : 'unknown',
    };
  });

  return res.json(comments);
});

app.post('/api/blogs/:id/comments', requireAuth, (req, res) => {
  const blogId = Number(req.params.id);
  const text = (req.body.comment || '').trim();

  if (!text) return res.status(400).json({ error: 'comment is required.' });
  if (text.length > 1000) return res.status(400).json({ error: 'comment too long (max 1000).' });

  const blog = db.findBlogById(blogId);
  if (!blog) return res.status(404).json({ error: 'Blog not found.' });

  db.addComment({ blog_id: blogId, user_id: req.user.id, comment: text });
  return res.status(201).json({ message: 'Comment added.' });
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err.message === 'Only image uploads are allowed.') {
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Blog platform server running on http://localhost:${PORT}`);
});
