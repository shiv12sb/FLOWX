(function () {
  const DEMO_MODE = true;
  const API_BASE_URL =
  window.FLOWX_CONFIG?.API_BASE_URL ||
  'https://flowx-traffic.onrender.com/api';
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
    // When on /pages/auth.html, 'dashboard.html' resolves to /pages/dashboard.html
    const dashboardPath = window.location.pathname.includes('/pages/') 
      ? 'dashboard.html' 
      : '/pages/dashboard.html';
    
    console.log('[AUTH] Redirecting to dashboard:', dashboardPath);
    window.location.href = dashboardPath;
    
    // Fallback in case redirect fails (network issue, etc)
    setTimeout(() => {
      console.error('[AUTH] Redirect failed, attempting alternative path');
      window.location.href = dashboardPath;
    }, 2000);
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

    const url = `${API_BASE_URL}${path}`;
    console.log('[API] Request:', { method, path, url });

    let response;
    try {
      response = await fetch(url, options);
    } catch (networkError) {
      const error = new Error(`Network error: ${networkError.message || 'Unable to reach server'}`);
      error.statusCode = 0;
      console.error('[API] Network error:', error.message);
      throw error;
    }

    let result = {};
    try {
      result = await response.json();
    } catch (parseError) {
      // If response is not JSON, create a generic error object
      result = {
        success: false,
        message: `Server error (${response.status})`
      };
      console.warn('[API] Response parse error, using fallback error object');
    }

    console.log('[API] Response:', { status: response.status, ok: response.ok, result });

    // Handle HTTP error responses
    if (!response.ok) {
      const errorMessage = result?.message || result?.error || `HTTP ${response.status}: ${response.statusText}`;
      const error = new Error(errorMessage);
      error.statusCode = response.status;
      console.error('[API] HTTP error:', error.message);
      throw error;
    }

    // Handle API-level errors (success: false)
    if (result.success === false) {
      const errorMessage = result.message || 'Request failed';
      const error = new Error(errorMessage);
      error.statusCode = result.statusCode || response.status;
      console.error('[API] API error:', error.message);
      throw error;
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
      }).catch(() => {
        console.warn('[AUTH] Logout API call failed, continuing with local logout');
      });
    }

    clearToken();
    sessionStorage.removeItem('flowx_user');
    console.log('[AUTH] User logged out, redirecting to auth page');
    
    // Handle path correctly whether on pages or root
    const authPath = window.location.pathname.includes('/pages/') 
      ? 'auth.html' 
      : '/pages/auth.html';
    window.location.replace(authPath);
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
    if (DEMO_MODE) {
      return true;
    }

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
        const submitButton = loginForm.querySelector('[type="submit"]');
        const originalButtonText = submitButton ? submitButton.textContent : 'Login to dashboard';
        const inputs = loginForm.querySelectorAll('input, button');
        let loginSuccess = false;

        const formData = new FormData(loginForm);
        const email = String(formData.get('email') || '').trim();
        const password = String(formData.get('password') || '');

        if (!email || !password) {
          setMessage('Please enter both email and password.', 'error');
          return;
        }

        // Disable form during submission
        inputs.forEach(input => input.disabled = true);
        if (submitButton) submitButton.textContent = 'Signing in...';

        try {
          console.log('[AUTH] Submitting login form', { email });
          setMessage('Signing in...', 'info');
          
          const result = await loginUser({ email, password });
          console.log('[AUTH] Login successful', result.message);
          loginSuccess = true;
          setMessage(result.message || 'Login successful. Redirecting...', 'success');
          
          // Ensure we redirect after success
          setTimeout(() => {
            console.log('[AUTH] Triggering redirect to dashboard');
            redirectToDashboard();
          }, 800);
        } catch (error) {
          console.error('[AUTH] Login failed', error);
          const errorMessage = error?.message || 'Unable to login right now. Please check your credentials.';
          setMessage(errorMessage, 'error');
        } finally {
          // Only restore button state if login failed
          // On success, keep disabled since we're redirecting
          if (!loginSuccess) {
            inputs.forEach(input => input.disabled = false);
            if (submitButton) submitButton.textContent = originalButtonText;
          }
        }
      });
    }

    if (signupForm) {
      signupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = signupForm.querySelector('[type="submit"]');
        const originalButtonText = submitButton ? submitButton.textContent : 'Create account';
        const inputs = signupForm.querySelectorAll('input, button');
        let signupSuccess = false;

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

        if (payload.password.length < 8) {
          setMessage('Password must be at least 8 characters long.', 'error');
          return;
        }

        // Disable form during submission
        inputs.forEach(input => input.disabled = true);
        if (submitButton) submitButton.textContent = 'Creating account...';

        try {
          console.log('[AUTH] Submitting signup form', { email: payload.email });
          setMessage('Creating your account...', 'info');
          
          const result = await signupUser(payload);
          console.log('[AUTH] Signup successful', result.message);
          signupSuccess = true;
          setMessage(result.message || 'Account created successfully. Redirecting...', 'success');
          
          // Ensure we redirect after success
          setTimeout(() => {
            console.log('[AUTH] Triggering redirect to dashboard');
            redirectToDashboard();
          }, 800);
        } catch (error) {
          console.error('[AUTH] Signup failed', error);
          const errorMessage = error?.message || 'Unable to create account. Please try again.';
          setMessage(errorMessage, 'error');
        } finally {
          // Only restore button state if signup failed
          // On success, keep disabled since we're redirecting
          if (!signupSuccess) {
            inputs.forEach(input => input.disabled = false);
            if (submitButton) submitButton.textContent = originalButtonText;
          }
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
