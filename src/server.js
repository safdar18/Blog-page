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
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/public', express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(uploadsDir));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => (file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only image uploads are allowed.'))),
});

function isValidUserId(userId) {
  return /^[a-zA-Z0-9_]{3,30}$/.test(userId);
}

function serializeBlog(blog) {
  const author = db.findUserById(blog.author_id);
  const stats = db.getBlogStats(blog.id);
  return {
    id: blog.id,
    title: blog.title,
    content: blog.content,
    excerpt: blog.excerpt,
    category: blog.category,
    tags: blog.tags,
    imagePath: blog.image_path,
    createdAt: blog.created_at,
    authorUserId: author ? author.user_id : 'unknown',
    authorId: blog.author_id,
    views: blog.views,
    likes: stats.likes,
    dislikes: stats.dislikes,
    commentsCount: stats.commentsCount,
    averageRating: stats.averageRating,
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/auth/register', authLimiter, (req, res) => {
  const { userId, email, password } = req.body;
  if (!userId || !email || !password) return res.status(400).json({ error: 'userId, email, and password are required.' });
  if (!isValidUserId(userId)) return res.status(400).json({ error: 'userId must be 3-30 chars, letters/numbers/underscore only.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const normalizedUserId = userId.trim();
  const normalizedEmail = email.trim().toLowerCase();
  if (db.findUserByUserIdOrEmail(normalizedUserId, normalizedEmail)) return res.status(409).json({ error: 'User ID or email already in use.' });

  const user = db.createUser({ user_id: normalizedUserId, email: normalizedEmail, password_hash: bcrypt.hashSync(password, 12) });
  const token = generateToken(user);
  return res.status(201).json({ token, user: { id: user.id, userId: user.user_id, email: user.email } });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { userIdOrEmail, password } = req.body;
  if (!userIdOrEmail || !password) return res.status(400).json({ error: 'userIdOrEmail and password are required.' });

  const normalized = userIdOrEmail.trim();
  const user = db.findUserByUserIdOrEmail(normalized, normalized.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials.' });

  const token = generateToken(user);
  return res.json({ token, user: { id: user.id, userId: user.user_id, email: user.email } });
});

app.get('/api/blogs', (req, res) => {
  const blogs = db.listBlogs({ search: req.query.search, category: req.query.category }).map(serializeBlog);
  return res.json(blogs);
});

app.get('/api/blogs/:id', (req, res) => {
  const blogId = Number(req.params.id);
  const increment = req.query.increment !== '0';
  const blog = increment ? db.incrementViewCount(blogId) : db.findBlogById(blogId);
  if (!blog) return res.status(404).json({ error: 'Blog not found.' });
  return res.json(serializeBlog(blog));
});

app.post('/api/blogs', requireAuth, upload.single('image'), (req, res) => {
  const { title, content, category, tags, excerpt } = req.body;
  if (!title || !content || !category) return res.status(400).json({ error: 'title, content and category are required.' });

  const blog = db.createBlog({
    author_id: req.user.id,
    title: title.trim(),
    content: content.trim(),
    excerpt: (excerpt || '').trim() || content.slice(0, 130),
    category: category.trim(),
    tags: (tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    image_path: req.file ? `/uploads/${req.file.filename}` : null,
  });

  return res.status(201).json({ id: blog.id, message: 'Blog created.' });
});

app.delete('/api/blogs/:id', requireAuth, (req, res) => {
  const blogId = Number(req.params.id);
  const blog = db.findBlogById(blogId);
  if (!blog) return res.status(404).json({ error: 'Blog not found.' });
  if (blog.author_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own posts.' });

  db.deleteBlogById(blogId);
  return res.json({ message: 'Post deleted.' });
});

app.post('/api/blogs/:id/reaction', requireAuth, (req, res) => {
  const blogId = Number(req.params.id);
  if (!db.findBlogById(blogId)) return res.status(404).json({ error: 'Blog not found.' });
  if (!['like', 'dislike'].includes(req.body.type)) return res.status(400).json({ error: 'type must be like or dislike.' });

  db.upsertReaction({ blog_id: blogId, user_id: req.user.id, type: req.body.type });
  return res.json({ message: `Reaction set to ${req.body.type}.` });
});

app.post('/api/blogs/:id/rating', requireAuth, (req, res) => {
  const blogId = Number(req.params.id);
  const rating = Number(req.body.rating);
  if (!db.findBlogById(blogId)) return res.status(404).json({ error: 'Blog not found.' });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be an integer between 1 and 5.' });

  db.upsertRating({ blog_id: blogId, user_id: req.user.id, rating });
  return res.json({ message: 'Rating submitted.' });
});

app.get('/api/blogs/:id/comments', requireAuth, (req, res) => {
  const blogId = Number(req.params.id);
  if (!db.findBlogById(blogId)) return res.status(404).json({ error: 'Blog not found.' });

  const comments = db.listCommentsByBlogId(blogId).map((comment) => ({
    id: comment.id,
    comment: comment.comment,
    created_at: comment.created_at,
    user_id: db.findUserById(comment.user_id)?.user_id || 'unknown',
  }));

  return res.json(comments);
});

app.post('/api/blogs/:id/comments', requireAuth, (req, res) => {
  const blogId = Number(req.params.id);
  const text = (req.body.comment || '').trim();
  if (!db.findBlogById(blogId)) return res.status(404).json({ error: 'Blog not found.' });
  if (!text) return res.status(400).json({ error: 'comment is required.' });
  if (text.length > 1000) return res.status(400).json({ error: 'comment too long (max 1000).' });

  db.addComment({ blog_id: blogId, user_id: req.user.id, comment: text });
  return res.status(201).json({ message: 'Comment added.' });
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
  if (err.message === 'Only image uploads are allowed.') return res.status(400).json({ error: err.message });
  return res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Blog platform server running on http://localhost:${PORT}`);
});
