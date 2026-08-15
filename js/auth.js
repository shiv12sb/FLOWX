(function () {
  const API_BASE_URL = 'http://localhost:4000/api';

  function setMessage(message, type = 'info') {
    const el = document.getElementById('auth-message');
    if (!el) return;

    el.textContent = message || '';
    el.className = 'auth-message';
    if (message) {
      el.classList.add('is-visible');
    }
    if (type === 'success') el.classList.add('auth-message--success');
    if (type === 'error') el.classList.add('auth-message--error');
  }

  function saveToken(token) {
    sessionStorage.setItem('flowx_token', token);
  }

  function getToken() {
    return sessionStorage.getItem('flowx_token');
  }

  function clearToken() {
    sessionStorage.removeItem('flowx_token');
  }

  function redirectToDashboard() {
    window.location.href = 'dashboard.html';
  }

  async function apiRequest(path, method = 'GET', body = null) {
    const headers = {
      'Content-Type': 'application/json'
    };

    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const options = {
      method,
      headers
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, options);
    const result = await response.json().catch(() => ({ success: false, message: 'Request failed.' }));

    if (!response.ok || result.success === false) {
      const message = result.message || 'Something went wrong.';
      throw new Error(message);
    }

    return result;
  }

  async function loginUser(payload) {
    const result = await apiRequest('/auth/login', 'POST', payload);
    const token = result.data?.token;
    if (token) saveToken(token);
    return result;
  }

  async function signupUser(payload) {
    const result = await apiRequest('/auth/signup', 'POST', payload);
    const token = result.data?.token;
    if (token) saveToken(token);
    return result;
  }

  async function getCurrentUser() {
    const token = getToken();
    if (!token) return null;

    try {
      const result = await apiRequest('/auth/me', 'GET');
      return result.data;
    } catch (error) {
      clearToken();
      return null;
    }
  }

  function guardDashboard() {
    const token = getToken();
    if (!token) {
      window.location.href = 'auth.html';
      return false;
    }

    return true;
  }

  function bindAuthForms() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    if (loginForm) {
      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(loginForm);
        const email = String(formData.get('email') || '').trim();
        const password = String(formData.get('password') || '');

        if (!email || !password) {
          setMessage('Please enter both email and password.', 'error');
          return;
        }

        try {
          setMessage('Signing in...', 'info');
          const result = await loginUser({ email, password });
          setMessage(result.message || 'Login successful.', 'success');
          setTimeout(() => redirectToDashboard(), 600);
        } catch (error) {
          setMessage(error.message || 'Unable to login right now.', 'error');
        }
      });
    }

    if (signupForm) {
      signupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(signupForm);
        const payload = {
          name: String(formData.get('name') || '').trim(),
          email: String(formData.get('email') || '').trim(),
          phone: String(formData.get('phone') || '').trim(),
          password: String(formData.get('password') || '')
        };

        if (!payload.name || !payload.email || !payload.password) {
          setMessage('Please provide your name, email, and password.', 'error');
          return;
        }

        try {
          setMessage('Creating your account...', 'info');gelopen
          const result = await signupUser(payload);
          setMessage(result.message || 'Signup successful.', 'success');
          setTimeout(() => redirectToDashboard(), 700);
        } catch (error) {
          setMessage(error.message || 'Signup failed. Please try again.', 'error');
        }
      });
    }
  }

  function init() {
    bindAuthForms();
  }

  window.STCAuth = {
    init,
    guardDashboard,
    loginUser,
    signupUser,
    getCurrentUser,
    clearToken,
    saveToken,
    getToken
  };
})();
