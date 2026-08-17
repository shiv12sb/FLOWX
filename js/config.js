/**
 * FLOWX Frontend Configuration
 * Determines API base URL based on current environment
 */

(function() {
  let apiBaseUrl;

  // Local development
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    apiBaseUrl = 'http://localhost:4000/api';
  } else {
    // Production frontend → Render backend
    apiBaseUrl = 'https://flowx-traffic.onrender.com/api';
  }

  // Optional meta tag override
  const metaTag = document.querySelector('meta[name="flowx-api-url"]');

  if (metaTag && metaTag.content) {
    apiBaseUrl = metaTag.content.endsWith('/api')
      ? metaTag.content
      : metaTag.content + '/api';
  }

  window.FLOWX_CONFIG = {
    API_BASE_URL: apiBaseUrl,
    isDevelopment:
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
  };

  console.log(
    '[FLOWX Config] Using API:',
    window.FLOWX_CONFIG.API_BASE_URL
  );
})();