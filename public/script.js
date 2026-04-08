const state = { token: localStorage.getItem('token') || '', me: null, posts: [] };

const statusEl = document.getElementById('status');
const postsGrid = document.getElementById('postsGrid');
const myPostsEl = document.getElementById('myPosts');

function showStatus(msg, error = false) { statusEl.style.color = error ? '#ff8e8e' : '#9dd39f'; statusEl.textContent = msg; }
function authHeader() { return state.token ? { Authorization: `Bearer ${state.token}` } : {}; }

async function api(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...(options.headers || {}), ...authHeader() } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function switchTab(id) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tabTarget === id));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === id));
}

document.querySelectorAll('.tab-btn,[data-tab-target]').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tabTarget)));

document.querySelectorAll('.mini-tab').forEach((btn) => btn.addEventListener('click', () => {
  document.querySelectorAll('.mini-tab').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  const signup = btn.dataset.authTab === 'signup';
  document.getElementById('signupForm').classList.toggle('hidden', !signup);
  document.getElementById('signinForm').classList.toggle('hidden', signup);
}));

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      userId: document.getElementById('signupUserId').value,
      email: document.getElementById('signupEmail').value,
      password: document.getElementById('signupPassword').value,
    })});
    state.token = data.token; state.me = data.user; localStorage.setItem('token', data.token);
    showStatus(`Welcome @${data.user.userId}. Account created.`); switchTab('feed-tab'); await loadPosts();
  } catch (err) { showStatus(err.message, true); }
});

document.getElementById('signinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      userIdOrEmail: document.getElementById('signinIdentifier').value,
      password: document.getElementById('signinPassword').value,
    })});
    state.token = data.token; state.me = data.user; localStorage.setItem('token', data.token);
    showStatus(`Signed in as @${data.user.userId}`); switchTab('feed-tab'); await loadPosts();
  } catch (err) { showStatus(err.message, true); }
});

document.getElementById('createPostForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.token) return showStatus('Please sign in first.', true);
  try {
    const fd = new FormData();
    fd.append('title', document.getElementById('postTitle').value);
    fd.append('category', document.getElementById('postCategory').value);
    fd.append('tags', document.getElementById('postTags').value);
    fd.append('excerpt', document.getElementById('postExcerpt').value);
    fd.append('content', document.getElementById('postContent').value);
    const file = document.getElementById('postImage').files[0];
    if (file) fd.append('image', file);
    await api('/api/blogs', { method: 'POST', body: fd });
    showStatus('Post created.'); e.target.reset(); switchTab('feed-tab'); await loadPosts();
  } catch (err) { showStatus(err.message, true); }
});

document.getElementById('searchInput').addEventListener('input', () => loadPosts());
document.getElementById('categoryFilter').addEventListener('change', () => loadPosts());

function renderPost(post, mine = false) {
  const tpl = document.getElementById('postTemplate').content.cloneNode(true);
  tpl.querySelector('.post-image').src = post.imagePath || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200';
  tpl.querySelector('.post-title').textContent = post.title;
  tpl.querySelector('.post-meta').textContent = `@${post.authorUserId} • ${new Date(post.createdAt).toLocaleString()} • ${post.category}`;
  tpl.querySelector('.post-excerpt').textContent = post.excerpt || post.content.slice(0, 160);
  tpl.querySelector('.chips').innerHTML = (post.tags || []).map((t) => `<span class='chip'>#${t}</span>`).join('');
  tpl.querySelector('.stats').innerHTML = `<span>👁 ${post.views}</span><span>❤️ ${post.likes}</span><span>👎 ${post.dislikes}</span><span>💬 ${post.commentsCount}</span><span>⭐ ${post.averageRating || 'N/A'}</span>`;

  tpl.querySelector('.likeBtn').onclick = async () => react(post.id, 'like');
  tpl.querySelector('.dislikeBtn').onclick = async () => react(post.id, 'dislike');
  tpl.querySelector('.ratingSelect').onchange = async (e) => e.target.value && rate(post.id, Number(e.target.value));

  const commentsEl = tpl.querySelector('.comments');
  tpl.querySelector('.commentBtn').onclick = async () => {
    try {
      const comments = await api(`/api/blogs/${post.id}/comments`);
      tpl.querySelector('.commentForm').classList.remove('hidden');
      commentsEl.innerHTML = comments.map((c) => `<div class='comment-item'><b>@${c.user_id}</b> ${c.comment}</div>`).join('') || '<div class="comment-item">No comments.</div>';
    } catch (err) { showStatus(err.message, true); }
  };

  tpl.querySelector('.commentForm').onsubmit = async (e) => {
    e.preventDefault();
    const input = e.currentTarget.querySelector('.commentInput');
    if (!input.value.trim()) return;
    try {
      await api(`/api/blogs/${post.id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment: input.value.trim() }) });
      input.value = ''; showStatus('Comment added'); await loadPosts();
    } catch (err) { showStatus(err.message, true); }
  };

  if (mine) {
    const del = document.createElement('button');
    del.className = 'btn delete-btn';
    del.textContent = 'Delete Post';
    del.onclick = async () => {
      if (!confirm('Delete this post permanently?')) return;
      try { await api(`/api/blogs/${post.id}`, { method: 'DELETE' }); showStatus('Post deleted.'); await loadPosts(); }
      catch (err) { showStatus(err.message, true); }
    };
    tpl.querySelector('.actions').appendChild(del);
  }

  return tpl;
}

async function react(id, type) { try { await api(`/api/blogs/${id}/reaction`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) }); await loadPosts(); } catch (err) { showStatus(err.message, true); } }
async function rate(id, rating) { try { await api(`/api/blogs/${id}/rating`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating }) }); await loadPosts(); } catch (err) { showStatus(err.message, true); } }

async function loadPosts() {
  try {
    const search = encodeURIComponent(document.getElementById('searchInput').value || '');
    const category = encodeURIComponent(document.getElementById('categoryFilter').value || 'All');
    state.posts = await api(`/api/blogs?search=${search}&category=${category}`);

    postsGrid.innerHTML = '';
    state.posts.forEach((p) => postsGrid.appendChild(renderPost(p, false)));

    myPostsEl.innerHTML = '';
    if (state.token) {
      let payload = null;
      try { payload = JSON.parse(atob(state.token.split('.')[1])); } catch {}
      const mine = state.posts.filter((p) => payload && p.authorId === payload.id);
      mine.forEach((p) => myPostsEl.appendChild(renderPost(p, true)));
      if (!mine.length) myPostsEl.innerHTML = '<div class="card">No posts by your account yet.</div>';
    } else {
      myPostsEl.innerHTML = '<div class="card">Sign in to manage your posts.</div>';
    }
  } catch (err) {
    showStatus(`Backend not reachable: ${err.message}`, true);
  }
}

loadPosts();
