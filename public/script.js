const statusEl = document.getElementById('status');
const blogsEl = document.getElementById('blogs');

const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const blogForm = document.getElementById('blog-form');

function getToken() {
  return localStorage.getItem('token');
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#b00020' : '#1f6a2f';
}

async function api(url, options = {}) {
  const token = getToken();
  const headers = options.headers || {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const payload = {
      userId: document.getElementById('register-userid').value,
      email: document.getElementById('register-email').value,
      password: document.getElementById('register-password').value,
    };

    const data = await api('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    localStorage.setItem('token', data.token);
    setStatus(`Registered successfully as @${data.user.userId}`);
    await loadBlogs();
  } catch (error) {
    setStatus(error.message, true);
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const payload = {
      userIdOrEmail: document.getElementById('login-identifier').value,
      password: document.getElementById('login-password').value,
    };

    const data = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    localStorage.setItem('token', data.token);
    setStatus(`Logged in as @${data.user.userId}`);
    await loadBlogs();
  } catch (error) {
    setStatus(error.message, true);
  }
});

blogForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const token = getToken();
  if (!token) {
    setStatus('Please create a user ID and login first to publish blogs.', true);
    return;
  }

  try {
    const formData = new FormData();
    formData.append('title', document.getElementById('blog-title').value);
    formData.append('content', document.getElementById('blog-content').value);

    const fileInput = document.getElementById('blog-image');
    if (fileInput.files[0]) {
      formData.append('image', fileInput.files[0]);
    }

    await api('/api/blogs', {
      method: 'POST',
      body: formData,
    });

    blogForm.reset();
    setStatus('Blog published successfully.');
    await loadBlogs();
  } catch (error) {
    setStatus(error.message, true);
  }
});

function renderComments(blogId, comments) {
  if (!comments.length) return '<p>No comments yet.</p>';
  return comments
    .map(
      (c) =>
        `<div><strong>@${c.user_id}</strong> (${new Date(c.created_at).toLocaleString()}): ${c.comment}</div>`
    )
    .join('');
}

async function loadComments(blogId, container) {
  try {
    const comments = await api(`/api/blogs/${blogId}/comments`);
    container.innerHTML = renderComments(blogId, comments);
  } catch (error) {
    container.innerHTML = `<em>${error.message}</em>`;
  }
}

async function loadBlogs() {
  try {
    const blogs = await api('/api/blogs');
    blogsEl.innerHTML = '';

    if (!blogs.length) {
      blogsEl.innerHTML = '<p>No blogs available yet.</p>';
      return;
    }

    blogs.forEach((blog) => {
      const article = document.createElement('article');
      article.className = 'blog';
      article.innerHTML = `
        <h3>${blog.title}</h3>
        <div class="row">
          <span class="pill">Author: @${blog.authorUserId}</span>
          <span class="pill">Likes: ${blog.likes}</span>
          <span class="pill">Dislikes: ${blog.dislikes}</span>
          <span class="pill">Comments: ${blog.commentsCount}</span>
          <span class="pill">Rating: ${blog.averageRating || 'N/A'}</span>
        </div>
        <p>${blog.content}</p>
        ${blog.imagePath ? `<img src="${blog.imagePath}" alt="${blog.title}" />` : ''}
        <small>${new Date(blog.createdAt).toLocaleString()}</small>
        <div class="row">
          <button data-reaction="like">Like</button>
          <button data-reaction="dislike">Dislike</button>
          <select data-rating>
            <option value="">Rate blog</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
          <button data-show-comments>Show Comments</button>
        </div>
        <form data-comment-form>
          <input type="text" data-comment-input placeholder="Write a comment" maxlength="1000" />
          <button type="submit">Comment</button>
        </form>
        <div class="comments" data-comments></div>
      `;

      article.querySelectorAll('[data-reaction]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await api(`/api/blogs/${blog.id}/reaction`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: btn.dataset.reaction }),
            });
            await loadBlogs();
          } catch (error) {
            setStatus(error.message, true);
          }
        });
      });

      article.querySelector('[data-rating]').addEventListener('change', async (event) => {
        if (!event.target.value) return;
        try {
          await api(`/api/blogs/${blog.id}/rating`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating: Number(event.target.value) }),
          });
          await loadBlogs();
        } catch (error) {
          setStatus(error.message, true);
        }
      });

      const commentsEl = article.querySelector('[data-comments]');
      article.querySelector('[data-show-comments]').addEventListener('click', () =>
        loadComments(blog.id, commentsEl)
      );

      article.querySelector('[data-comment-form]').addEventListener('submit', async (event) => {
        event.preventDefault();
        const input = article.querySelector('[data-comment-input]');
        const comment = input.value.trim();
        if (!comment) return;
        try {
          await api(`/api/blogs/${blog.id}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment }),
          });
          input.value = '';
          await loadComments(blog.id, commentsEl);
          await loadBlogs();
        } catch (error) {
          setStatus(error.message, true);
        }
      });

      blogsEl.appendChild(article);
    });
  } catch (error) {
    setStatus(error.message, true);
  }
}

loadBlogs();
