/**
 * Smart Traffic Command Center — Utility Functions
 * Phase 1: Basic UI helpers only
 */

const STCUtils = {
  /**
   * Select a single DOM element
   * @param {string} selector
   * @param {Element} [context=document]
   * @returns {Element|null}
   */
  $(selector, context = document) {
    return context.querySelector(selector);
  },

  /**
   * Select multiple DOM elements
   * @param {string} selector
   * @param {Element} [context=document]
   * @returns {NodeListOf<Element>}
   */
  $$(selector, context = document) {
    return context.querySelectorAll(selector);
  },

  /**
   * Debounce a function call
   * @param {Function} fn
   * @param {number} delay
   * @returns {Function}
   */
  debounce(fn, delay = 250) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Get the current page filename from the URL
   * @returns {string}
   */
  getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1);
    return filename || 'index.html';
  },

  /**
   * Format a number with locale separators
   * @param {number} value
   * @returns {string}
   */
  formatNumber(value) {
    return new Intl.NumberFormat().format(value);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = STCUtils;
}
