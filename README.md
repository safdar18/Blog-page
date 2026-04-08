# Blog Platform (Frontend + Backend)

A secure full-stack blog page with:
- User ID creation + authentication
- Blog post creation with image upload
- Public visibility of likes/dislikes/comments counts
- Comments/likes/dislikes/ratings per blog
- Comment reading restricted to authenticated users (prompting user-ID creation first)

## Tech stack
- Node.js + Express (Node 16+ compatible)
- JSON file storage (`data.json`) for users/blogs/interactions
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
- Input checks and upload validation

## Why this avoids your install error
- Removed `better-sqlite3` (native module that required Visual Studio build tools on your Windows setup).
- Downgraded to `helmet@7` to support Node 16.14.x.
- Upgraded to `multer@2` to avoid 1.x deprecation warnings.
