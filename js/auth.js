(function () {
  const API_BASE_URL = 'http://localhost:4000/api';
  let oauthPopup = null;

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

  /**
   * Initiate Google OAuth flow
   */
  async function initiateGoogleAuth() {
    try {
      setMessage('Connecting to Google...', 'info');
      
      const result = await apiRequest('/auth/google/initiate', 'GET');
      if (!result.data?.url) {
        setMessage('Google OAuth is not configured. Please contact administrator.', 'error');
        return;
      }

      // Open OAuth consent screen in popup
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      oauthPopup = window.open(
        result.data.url,
        'google-oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!oauthPopup) {
        setMessage('Could not open Google auth popup. Check browser popup settings.', 'error');
        return;
      }

      // Listen for OAuth callback from popup
      window.addEventListener('message', async (event) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'oauth-callback' && event.data.provider === 'google') {
          if (oauthPopup) oauthPopup.close();

          if (event.data.error) {
            setMessage(`Google auth failed: ${event.data.error}`, 'error');
            return;
          }

          if (event.data.token) {
            saveToken(event.data.token);
            setMessage('Login successful!', 'success');
            setTimeout(() => redirectToDashboard(), 600);
          }
        }
      }, { once: false });
    } catch (error) {
      setMessage(error.message || 'Google authentication failed.', 'error');
    }
  }

  /**
   * Initiate Apple OAuth flow
   */
  async function initiateAppleAuth() {
    try {
      setMessage('Connecting to Apple...', 'info');

      const result = await apiRequest('/auth/apple/initiate', 'GET');
      if (!result.data?.url) {
        setMessage('Apple OAuth is not configured. Please contact administrator.', 'error');
        return;
      }

      // Open OAuth consent screen in popup
      const width = 500;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      oauthPopup = window.open(
        result.data.url,
        'apple-oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!oauthPopup) {
        setMessage('Could not open Apple auth popup. Check browser popup settings.', 'error');
        return;
      }

      // Listen for OAuth callback from popup
      window.addEventListener('message', async (event) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'oauth-callback' && event.data.provider === 'apple') {
          if (oauthPopup) oauthPopup.close();

          if (event.data.error) {
            setMessage(`Apple auth failed: ${event.data.error}`, 'error');
            return;
          }

          if (event.data.token) {
            saveToken(event.data.token);
            setMessage('Login successful!', 'success');
            setTimeout(() => redirectToDashboard(), 600);
          }
        }
      }, { once: false });
    } catch (error) {
      setMessage(error.message || 'Apple authentication failed.', 'error');
    }
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
          setMessage('Creating your account...', 'info');
          const result = await signupUser(payload);
          setMessage(result.message || 'Signup successful.', 'success');
          setTimeout(() => redirectToDashboard(), 700);
        } catch (error) {
          setMessage(error.message || 'Signup failed. Please try again.', 'error');
        }
      });
    }

    // Bind OAuth buttons
    const googleButton = document.querySelector('.auth-methods button:nth-child(1)');
    const appleButton = document.querySelector('.auth-methods button:nth-child(2)');

    if (googleButton) {
      googleButton.addEventListener('click', (e) => {
        e.preventDefault();
        initiateGoogleAuth();
      });
    }

    if (appleButton) {
      appleButton.addEventListener('click', (e) => {
        e.preventDefault();
        initiateAppleAuth();
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
    getToken,
    initiateGoogleAuth,
    initiateAppleAuth
  };
})();
