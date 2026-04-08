# BlogVerse (Windows-friendly Full Stack Blog)

This project includes:
- Sign Up / Sign In on one page (tabbed auth panel)
- Create post (title, category, tags, excerpt, content, image)
- Delete your own posts
- Likes, dislikes, ratings, comments
- Visible counts for views, likes, dislikes, comments, ratings
- Comments protected behind authentication (user must create/sign in first)

Storage is JSON-based (`data.json`) so no Visual Studio C++ build tools are required.

---

## 1) Install prerequisites (Windows)

1. Install **Node.js 16.14+** (or newer LTS) from: https://nodejs.org/
2. Open **PowerShell**.
3. Check versions:
   ```powershell
   node -v
   npm -v
   ```

---

## 2) Open project folder

1. In PowerShell, run:
   ```powershell
   cd C:\Users\<YOUR_USER>\OneDrive\Desktop\Blog-page
   ```
2. Confirm files exist:
   ```powershell
   dir
   ```

---

## 3) Install dependencies

```powershell
npm install
```

If installation fails, copy the full terminal error and verify your internet/proxy/firewall settings.

---

## 4) Configure environment

1. Create `.env` from template:
   ```powershell
   copy .env.example .env
   ```
2. Open `.env` and set a strong secret:
   ```
   PORT=3000
   JWT_SECRET=replace_with_a_long_random_secret
   ```

---

## 5) Start backend + frontend

```powershell
npm start
```

You should see:
`Blog platform server running on http://localhost:3000`

---

## 6) Use the app

1. Open browser: **http://localhost:3000**
2. Go to **Sign In / Sign Up** tab.
3. Create account in **Sign Up** form.
4. Go to **Create Post** tab and publish a post.
5. Go to **Feed** tab to like/dislike/rate/comment.
6. Go to **Delete My Posts** tab to delete posts created by your account.

---

## 7) Troubleshooting

### App opens but no posts load
- Ensure terminal still running `npm start`.
- Open `http://localhost:3000/api/health` in browser; expected: `{"ok":true}`.

### "You must create a user ID and login first"
- This is expected for comments/reactions on protected actions.
- Sign in from the auth tab first.

### Port already in use
- Change `PORT` in `.env` (e.g., `PORT=3001`) and restart.

---

## Scripts
- `npm start` → run server
- `npm run dev` → run with watch mode
- `npm run check` → syntax check
