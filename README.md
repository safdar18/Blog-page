# Blog Platform (Frontend + Backend)

A secure full-stack blog page with:
- User ID creation + authentication
- Blog post creation with image upload
- Public visibility of likes/dislikes/comments counts
- Comments/likes/dislikes/ratings per blog
- Comment reading restricted to authenticated users (prompting user-ID creation first)

## Tech stack
- Node.js + Express
- SQLite (`better-sqlite3`)
- Vanilla HTML/CSS/JS frontend

## Run
```bash
npm install
cp .env.example .env
npm start
```

Open: `http://localhost:3000`

## Security included
- Password hashing with bcrypt
- JWT-based authentication
- Helmet HTTP hardening
- Rate limiting on auth routes
- Input checks and DB constraints
