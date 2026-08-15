(function () {
  function createHistoryBuffer(maxSize = 120) {
    return {
      maxSize: Math.max(20, Number(maxSize) || 120),
      records: []
    };
  }

  function appendSnapshot(buffer, snapshot) {
    if (!buffer || !Array.isArray(buffer.records)) {
      buffer = createHistoryBuffer();
    }

    if (!snapshot || typeof snapshot !== 'object') {
      return buffer;
    }

    buffer.records.push({ ...snapshot });

    if (buffer.records.length > buffer.maxSize) {
      buffer.records = buffer.records.slice(buffer.records.length - buffer.maxSize);
    }

    return buffer;
  }

  function getRecentValues(buffer, key, count = 12) {
    if (!buffer || !Array.isArray(buffer.records)) return [];
    const recent = buffer.records.slice(-count);
    return recent.map((entry) => Number(entry[key]) || 0);
  }

  function getLatest(buffer) {
    if (!buffer || !Array.isArray(buffer.records) || !buffer.records.length) return null;
    return buffer.records[buffer.records.length - 1];
  }

  if (typeof window !== 'undefined') {
    window.FlowXPredictionHistory = { createHistoryBuffer, appendSnapshot, getRecentValues, getLatest };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createHistoryBuffer, appendSnapshot, getRecentValues, getLatest };
  }
})();
