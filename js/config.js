/**
 * FLOWX Frontend Configuration
 * Determines API base URL based on current environment
 */

(function() {
  // Determine API base URL
  let apiBaseUrl = window.location.origin + '/api';
  
  // Override for local development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    apiBaseUrl = 'http://localhost:4000/api';
  }
  
  // Allow override via environment variable or meta tag
  const metaTag = document.querySelector('meta[name="flowx-api-url"]');
  if (metaTag && metaTag.content) {
    apiBaseUrl = metaTag.content + '/api';
  }
  
  // Store globally for all auth modules
  window.FLOWX_CONFIG = {
    API_BASE_URL: apiBaseUrl,
    isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  };
  
  // Log configuration in development
  if (window.FLOWX_CONFIG.isDevelopment) {
    console.log('[FLOWX Config] Using API:', window.FLOWX_CONFIG.API_BASE_URL);
  }
})();
