

const listeners = [];

export const ticketBroadcast = {
  /**
   * @param {string} type - Event type: 'assigned', 'status_changed', 'resolved', etc.
   * @param {object} ticket - The updated ticket object
   */
  emit(type, ticket) {
    const event = { type, ticket, timestamp: Date.now() };
    listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (err) {
        console.error('Error in ticket broadcast listener:', err);
      }
    });
  },

  /**
   * Subscribe to ticket updates
   * @param {function} callback - Called with { type, ticket, timestamp }
   * @returns {function} Unsubscribe function
   */
  subscribe(callback) {
    listeners.push(callback);
    return () => {
      const idx = listeners.indexOf(callback);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  },
};
