/**
 * PROJECT VECTOR — Application Entry Point
 * Phase 1: UI initialization only
 */

const STCApp = {
  init() {
    PVTheme.init();
    STCNavigation.init();
    this.initNotifications();
    this.initDemoNotice();
  },

  initNotifications() {
    const notifBtn = STCUtils.$('#notifications-btn');
    if (!notifBtn) return;

    notifBtn.addEventListener('click', () => {
      notifBtn.classList.toggle('is-active');
    });
  },

  initDemoNotice() {
    console.info(
      '%c PROJECT VECTOR ',
      'background: #00c8ff; color: #060b14; font-weight: bold; padding: 4px 8px; border-radius: 4px;',
      '\nPhase 1 — Frontend Foundation\nAll displayed data is DEMO DATA only.'
    );
  }
};

document.addEventListener('DOMContentLoaded', () => {
  STCApp.init();
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = STCApp;
}
