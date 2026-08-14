/**
 * Smart Traffic Command Center — Navigation Module
 * Phase 1: Sidebar, mobile menu, active nav state
 */

const STCNavigation = {
  sidebar: null,
  overlay: null,
  menuBtn: null,
  isOpen: false,

  /**
   * Initialize navigation interactions
   */
  init() {
    this.sidebar = STCUtils.$('#sidebar');
    this.overlay = STCUtils.$('#sidebar-overlay');
    this.menuBtn = STCUtils.$('#menu-toggle');

    this.setActiveNavLink();
    this.bindEvents();
  },

  /**
   * Highlight the active navigation link based on current page
   */
  setActiveNavLink() {
    const currentPage = STCUtils.getCurrentPage();
    const navLinks = STCUtils.$$('.nav-link');

    navLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;

      const linkPage = href.substring(href.lastIndexOf('/') + 1);
      const isActive =
        linkPage === currentPage ||
        (currentPage === 'index.html' && linkPage === 'dashboard.html');

      link.classList.toggle('is-active', isActive);

      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  },

  /**
   * Bind navigation event listeners
   */
  bindEvents() {
    if (this.menuBtn) {
      this.menuBtn.addEventListener('click', () => this.toggleSidebar());
    }

    if (this.overlay) {
      this.overlay.addEventListener('click', () => this.closeSidebar());
    }

    const navLinks = STCUtils.$$('.nav-link');
    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 992) {
          this.closeSidebar();
        }
      });
    });

    window.addEventListener(
      'resize',
      STCUtils.debounce(() => {
        if (window.innerWidth > 992 && this.isOpen) {
          this.closeSidebar();
        }
      }, 150)
    );

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.closeSidebar();
      }
    });
  },

  /**
   * Toggle sidebar open/closed on mobile
   */
  toggleSidebar() {
    if (this.isOpen) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  },

  /**
   * Open the mobile sidebar
   */
  openSidebar() {
    if (!this.sidebar) return;

    this.isOpen = true;
    this.sidebar.classList.add('is-open');
    this.overlay?.classList.add('is-visible');
    this.menuBtn?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  },

  /**
   * Close the mobile sidebar
   */
  closeSidebar() {
    if (!this.sidebar) return;

    this.isOpen = false;
    this.sidebar.classList.remove('is-open');
    this.overlay?.classList.remove('is-visible');
    this.menuBtn?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = STCNavigation;
}
