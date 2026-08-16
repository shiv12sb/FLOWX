(function () {
  const API_BASE_URL = window.FLOWX_CONFIG?.API_BASE_URL || 'http://localhost:4000/api';
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
      const user = result.data;
      if (user) {
        sessionStorage.setItem('flowx_user', JSON.stringify(user));
      }
      return user;
    } catch (error) {
      clearToken();
      sessionStorage.removeItem('flowx_user');
      return null;
    }
  }

  async function updateCurrentUser(payload) {
    const token = getToken();
    if (!token) {
      throw new Error('You must be logged in to update your profile.');
    }

    const result = await apiRequest('/auth/me', 'PATCH', payload);
    if (result.data) {
      sessionStorage.setItem('flowx_user', JSON.stringify(result.data));
    }
    return result.data;
  }

  function logoutUser() {
    const token = getToken();
    if (token) {
      fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }).catch(() => {});
    }

    clearToken();
    sessionStorage.removeItem('flowx_user');
    window.location.replace('auth.html');
  }

  function getStoredUser() {
    try {
      const raw = sessionStorage.getItem('flowx_user');
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function formatUserRole(role) {
    if (!role) return 'User';
    return String(role).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function getUserInitials(name) {
    const source = (name || '').trim();
    if (!source) return 'OP';
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function updateUserIdentity(user) {
    const profile = user || getStoredUser();
    const userBlocks = document.querySelectorAll('.topbar__user');

    userBlocks.forEach((block) => {
      const nameNode = block.querySelector('.topbar__user-name');
      const roleNode = block.querySelector('.topbar__user-role');
      const avatarNode = block.querySelector('.topbar__avatar');

      if (nameNode) {
        nameNode.textContent = profile?.name || 'Operator';
      }

      if (roleNode) {
        roleNode.textContent = formatUserRole(profile?.role || 'Traffic Control');
      }

      if (avatarNode) {
        avatarNode.textContent = getUserInitials(profile?.name || 'Operator');
      }
    });
  }

  function guardDashboard() {
    const token = getToken();
    if (!token) {
      window.location.href = 'auth.html';
      return false;
    }

    return true;
  }

  function initUserMenu() {
    const trigger = document.querySelector('.topbar__user');
    if (!trigger || trigger.dataset.menuInitialized === 'true') return;

    trigger.dataset.menuInitialized = 'true';
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.tabIndex = 0;

    const menu = document.createElement('div');
    menu.className = 'topbar__user-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-hidden', 'true');
    menu.innerHTML = `
      <button class="topbar__user-menu-item" type="button" data-action="profile">Profile</button>
      <button class="topbar__user-menu-item" type="button" data-action="settings">Settings</button>
      <button class="topbar__user-menu-item topbar__user-menu-item--danger" type="button" data-action="logout">Logout</button>
    `;

    trigger.style.position = 'relative';
    trigger.appendChild(menu);

    const openMenu = () => {
      menu.classList.add('is-open');
      menu.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
    };

    const closeMenu = () => {
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      trigger.setAttribute('aria-expanded', 'false');
    };

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = menu.classList.contains('is-open');
      if (isOpen) closeMenu(); else openMenu();
    });

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        trigger.click();
      }
      if (event.key === 'Escape') closeMenu();
    });

    menu.querySelector('[data-action="profile"]').addEventListener('click', () => {
      closeMenu();
      window.location.href = 'profile.html';
    });

    menu.querySelector('[data-action="settings"]').addEventListener('click', () => {
      closeMenu();
      window.location.href = 'settings.html';
    });

    menu.querySelector('[data-action="logout"]').addEventListener('click', () => {
      closeMenu();
      logoutUser();
    });

    document.addEventListener('click', (event) => {
      if (!trigger.contains(event.target) && !menu.contains(event.target)) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });

    updateUserIdentity(getStoredUser());
  }

  async function hydrateUserSession() {
    const token = getToken();
    if (!token) return null;

    const storedUser = getStoredUser();
    if (storedUser) {
      updateUserIdentity(storedUser);
    }

    const user = await getCurrentUser();
    if (user) {
      updateUserIdentity(user);
    }

    return user || storedUser;
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
        const data = event && event.data;
        if (!data || data.type !== 'oauth-callback' || data.provider !== 'google') return;
        if (oauthPopup) oauthPopup.close();

        if (data.error) {
          setMessage(`Google auth failed: ${data.error}`, 'error');
          return;
        }

        if (data.token) {
          saveToken(data.token);
          setMessage('Login successful!', 'success');
          setTimeout(() => redirectToDashboard(), 600);
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
        const data = event && event.data;
        if (!data || data.type !== 'oauth-callback' || data.provider !== 'apple') return;
        if (oauthPopup) oauthPopup.close();

        if (data.error) {
          setMessage(`Apple auth failed: ${data.error}`, 'error');
          return;
        }

        if (data.token) {
          saveToken(data.token);
          setMessage('Login successful!', 'success');
          setTimeout(() => redirectToDashboard(), 600);
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
    initUserMenu();
    hydrateUserSession();
  }

  window.STCAuth = {
    init,
    guardDashboard,
    loginUser,
    signupUser,
    getCurrentUser,
    updateCurrentUser,
    clearToken,
    saveToken,
    getToken,
    logoutUser,
    getStoredUser,
    hydrateUserSession,
    initUserMenu,
    updateUserIdentity,
    formatUserRole,
    getUserInitials,
    initiateGoogleAuth,
    initiateAppleAuth
  };
})();
