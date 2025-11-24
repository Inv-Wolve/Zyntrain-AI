/**
 * API Service
 * Centralized API communication layer
 */

// API Configuration
const API_CONFIG = {
  BASE_URL: (() => {
    const { hostname, protocol } = window.location;
    
    // Production
    if (hostname === 'timeswap.zykro.dev' || hostname === 'zykro.dev') {
      return 'https://timeswap.zykro.dev'; // Ensure this points to the correct backend URL
    }
    
    // Development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:4567';
    }
    
    // Fallback
    return 'https://timeswap.zykro.dev';
  })(),
  
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/api/auth/login',
      REGISTER: '/api/auth/register',
      VERIFY: '/api/auth/verify',
      FORGOT_PASSWORD: '/api/auth/forgot-password',
      RESET_PASSWORD: '/api/auth/reset-password',
      ENABLE_2FA: '/api/auth/enable-2fa',
      VERIFY_2FA: '/api/auth/verify-2fa'
    },
    USER: {
      UPDATE: '/api/user/update'
    },
    TASKS: {
      BASE: '/api/tasks',
      BY_ID: (id) => `/api/tasks/${id}`
    },
    AI: {
      CHATS: '/api/ai/chats'
    },
    CALENDAR: {
      AUTH_URL: '/api/calendar/auth-url',
      EVENTS: '/api/calendar/events',
      SYNC: '/api/calendar/sync',
      CREATE_EVENT: '/api/calendar/create-event'
    },
    INTEGRATIONS: {
      STATUS: '/api/integrations/status',
      DISCONNECT: (type) => `/api/integrations/${type}`
    }
  }
};

export class ApiService {
  static async makeRequest(endpoint, options = {}) {
    const token = localStorage.getItem('authToken');
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      credentials: 'include'
    };

    const config = {
      ...defaultOptions,
      ...options,
      headers: { ...defaultOptions.headers, ...options.headers }
    };

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, config);

      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response);
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return response.json();
      }

      return response.text();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check your connection.');
      }
      throw error;
    }
  }

  static async parseErrorResponse(response) {
    try {
      return await response.json();
    } catch {
      return { message: `HTTP ${response.status}: ${response.statusText}` };
    }
  }

  // Authentication methods
  static async login(email, password) {
    return this.makeRequest(API_CONFIG.ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  static async register(userData) {
    return this.makeRequest(API_CONFIG.ENDPOINTS.AUTH.REGISTER, {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  static async getCurrentUser() {
    return this.makeRequest(API_CONFIG.ENDPOINTS.AUTH.VERIFY);
  }

  static async updateUser(updates) {
    return this.makeRequest(API_CONFIG.ENDPOINTS.USER.UPDATE, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  static async requestPasswordReset(email) {
    return this.makeRequest(API_CONFIG.ENDPOINTS.AUTH.FORGOT_PASSWORD, {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  // Task management
  static async getTasks() {
    return this.makeRequest(API_CONFIG.ENDPOINTS.TASKS.BASE);
  }

  static async addTask(task) {
    return this.makeRequest(API_CONFIG.ENDPOINTS.TASKS.BASE, {
      method: 'POST',
      body: JSON.stringify(task)
    });
  }

  static async updateTask(taskId, updates) {
    return this.makeRequest(API_CONFIG.ENDPOINTS.TASKS.BY_ID(taskId), {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  static async deleteTask(taskId) {
    return this.makeRequest(API_CONFIG.ENDPOINTS.TASKS.BY_ID(taskId), {
      method: 'DELETE'
    });
  }

  // AI Chat
  static async getAIChats() {
    return this.makeRequest(API_CONFIG.ENDPOINTS.AI.CHATS);
  }

  static async addAIChat(message, response) {
    return this.makeRequest(API_CONFIG.ENDPOINTS.AI.CHATS, {
      method: 'POST',
      body: JSON.stringify({ message, response })
    });
  }

  static async clearAIChats() {
    return this.makeRequest(API_CONFIG.ENDPOINTS.AI.CHATS, {
      method: 'DELETE'
    });
  }

  // Calendar integration
  static async getCalendarAuthUrl() {
    return this.makeRequest(API_CONFIG.ENDPOINTS.CALENDAR.AUTH_URL);
  }

  static async getCalendarEvents() {
    try {
      return await this.makeRequest(API_CONFIG.ENDPOINTS.CALENDAR.EVENTS);
    } catch (error) {
      if (error.message.includes('not connected') || error.message.includes('401')) {
        return { success: false, message: 'Google Calendar not connected', events: [] };
      }
      throw error;
    }
  }

  static async syncGoogleCalendar() {
    return this.makeRequest(API_CONFIG.ENDPOINTS.CALENDAR.SYNC, {
      method: 'POST'
    });
  }

  static async createCalendarEvent(eventData) {
    try {
      return await this.makeRequest(API_CONFIG.ENDPOINTS.CALENDAR.CREATE_EVENT, {
        method: 'POST',
        body: JSON.stringify(eventData)
      });
    } catch (error) {
      console.warn('Could not sync to calendar:', error.message);
      return { success: false, message: 'Calendar not connected' };
    }
  }

  // Integrations
  static async getIntegrationStatus() {
    try {
      return await this.makeRequest(API_CONFIG.ENDPOINTS.INTEGRATIONS.STATUS);
    } catch (error) {
      console.warn('Could not get integration status:', error);
      return { integrations: {} };
    }
  }

  static async disconnectIntegration(integration) {
    return this.makeRequest(API_CONFIG.ENDPOINTS.INTEGRATIONS.DISCONNECT(integration), {
      method: 'DELETE'
    });
  }

  // Utility methods
  static async getPreferences() {
    return this.makeRequest('/api/preferences').catch(() => ({}));
  }

  static async savePreferences(preferences) {
    return this.makeRequest('/api/preferences', {
      method: 'POST',
      body: JSON.stringify(preferences)
    });
  }

  static async getAnalytics() {
    return this.makeRequest('/api/analytics').catch(() => ({}));
  }

  static async getSchedule() {
    return this.makeRequest('/api/schedule').catch(() => ({ events: [] }));
  }
}

// Global export for backward compatibility
window.DataService = ApiService;
window.ApiService = ApiService;