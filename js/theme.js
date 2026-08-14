/**
 * PROJECT VECTOR — Theme Module
 * Dark / Light theme with localStorage persistence
 */

const PVTheme = {
  STORAGE_KEY: 'pv-theme',

  /**
   * Apply theme before first paint (call from head)
   */
  applyEarly() {
    const theme = this.getStoredTheme();
    document.documentElement.setAttribute('data-theme', theme);
  },

  /**
   * Get stored theme or system preference
   * @returns {'dark'|'light'}
   */
  getStoredTheme() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;

    return window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  },

  /**
   * Set and persist theme
   * @param {'dark'|'light'} theme
   */
  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
    this.updateToggleUI(theme);
  },

  /**
   * Toggle between dark and light
   */
  toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    this.setTheme(current === 'dark' ? 'light' : 'dark');
  },

  /**
   * Update theme toggle button icons and label
   * @param {'dark'|'light'} theme
   */
  updateToggleUI(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.dataset.theme = theme;
  },

  /**
   * Bind theme toggle button
   */
  init() {
    this.updateToggleUI(this.getStoredTheme());

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => this.toggle());
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(this.STORAGE_KEY)) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
};

PVTheme.applyEarly();
