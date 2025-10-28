/**
 * Profile Page Handler
 * Manages user profile, preferences, integrations, and settings
 */

import { Utils } from './utils.js';
import { NotificationService } from './services/notification.js';
import { ApiService } from './services/api.js';
import { ConfirmationDialog } from './components/confirmation-dialog.js';

class ProfilePage {
  constructor() {
    this.state = {
      currentSection: 'profile',
      userProfile: {},
      preferences: {},
      integrations: {}
    };
    
    this.formManager = new ProfileFormManager();
    this.integrationManager = new IntegrationManager();
    this.settingsManager = new SettingsManager();
    this.eventListeners = [];
    
    this.init();
  }

  async init() {
    this.initNavigation();
    this.initEventListeners();
    await this.loadData();
    this.updateUI();
  }

  initNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    
    navItems.forEach(item => {
      const handler = (e) => {
        e.preventDefault();
        this.navigateToSection(item.dataset.section);
      };

      item.addEventListener('click', handler);
      this.eventListeners.push({ element: item, event: 'click', handler });
    });
  }

  navigateToSection(sectionId) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');

    // Update sections
    document.querySelectorAll('.section').forEach(section => {
      section.classList.remove('active');
    });
    document.getElementById(sectionId)?.classList.add('active');

    this.state.currentSection = sectionId;
  }

  initEventListeners() {
    const clickHandler = (e) => {
      const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
      if (action) {
        e.preventDefault();
        this.handleAction(action, e.target);
      }
    };

    document.addEventListener('click', clickHandler);
    this.eventListeners.push({ element: document, event: 'click', handler: clickHandler });
  }

  handleAction(action, element) {
    const actions = {
      'connect-google-calendar': () => this.integrationManager.connectGoogleCalendar(),
      'disconnect-google-calendar': () => this.integrationManager.disconnectGoogleCalendar(),
      'connect-notion': () => this.integrationManager.connectNotion(),
      'disconnect-notion': () => this.integrationManager.disconnectNotion(),
      'toggle-2fa': () => this.settingsManager.toggle2FA(element.checked),
      'export-data': () => this.settingsManager.exportUserData(),
      'share-with-friends': () => this.settingsManager.shareWithFriends()
    };

    const handler = actions[action];
    if (handler) {
      handler();
    }
  }

  async loadData() {
    try {
      const [userResponse, preferencesResponse, integrationsResponse] = await Promise.all([
        ApiService.getCurrentUser().catch(() => null),
        ApiService.getPreferences().catch(() => ({})),
        ApiService.getIntegrationStatus().catch(() => ({ integrations: {} }))
      ]);

      this.state.userProfile = userResponse || {};
      this.state.preferences = preferencesResponse;
      this.state.integrations = integrationsResponse.integrations || {};

      // Update managers with new data
      this.formManager.updateData(this.state.userProfile, this.state.preferences);
      this.integrationManager.updateIntegrations(this.state.integrations);

    } catch (error) {
      console.error('Error loading profile data:', error);
      NotificationService.show('Error loading profile data. Please refresh the page.', 'error');
    }
  }

  updateUI() {
    this.updateProfileInfo();
    this.formManager.populateForms();
    this.integrationManager.updateUI();
    this.updateUsageStats();
  }

  updateProfileInfo() {
    const userNameEl = document.getElementById('userName');
    const userEmailEl = document.getElementById('userEmail');
    
    if (userNameEl) userNameEl.textContent = this.state.userProfile.name || 'User';
    if (userEmailEl) userEmailEl.textContent = this.state.userProfile.email || '';
    
    // Update avatar
    const avatar = document.getElementById('profileAvatar');
    if (avatar && this.state.userProfile.name) {
      avatar.textContent = Utils.generateAvatar(this.state.userProfile.name);
    }

    // Update account created date
    const accountCreated = document.getElementById('accountCreated');
    if (accountCreated && this.state.userProfile.createdAt) {
      accountCreated.textContent = Utils.formatDate(this.state.userProfile.createdAt);
    }
  }

  updateUsageStats() {
    // This would be populated with real analytics data
    const statsElements = document.querySelectorAll('.stat-item .stat-info h4');
    if (statsElements.length >= 3) {
      statsElements[0].textContent = '0'; // Tasks this month
      statsElements[1].textContent = '0'; // AI suggestions
      statsElements[2].textContent = '0h'; // Time optimized
    }
  }

  // Public methods for external access
  async toggle2FA(enabled) {
    return this.settingsManager.toggle2FA(enabled);
  }

  async connectGoogleCalendar(skipGuide = false) {
    return this.integrationManager.connectGoogleCalendar(skipGuide);
  }

  destroy() {
    // Clean up event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    // Clean up managers
    if (this.formManager) this.formManager.destroy();
    if (this.integrationManager) this.integrationManager.destroy();
    if (this.settingsManager) this.settingsManager.destroy();
  }
}

/**
 * Profile Form Manager - Handles all form operations
 */
class ProfileFormManager {
  constructor() {
    this.userProfile = {};
    this.preferences = {};
    this.eventListeners = [];
    this.initEventListeners();
  }

  initEventListeners() {
    const forms = [
      { id: 'profileForm', handler: (formData) => this.handleProfileUpdate(formData) },
      { id: 'securityForm', handler: (formData) => this.handlePasswordUpdate(formData) },
      { id: 'workingHoursForm', handler: () => this.handleWorkingHoursUpdate() },
      { id: 'energyForm', handler: () => this.handleEnergyPreferencesUpdate() }
    ];

    forms.forEach(({ id, handler }) => {
      const form = document.getElementById(id);
      if (form) {
        const submitHandler = (e) => {
          e.preventDefault();
          handler(new FormData(e.target));
        };

        form.addEventListener('submit', submitHandler);
        this.eventListeners.push({ element: form, event: 'submit', handler: submitHandler });
      }
    });

    // Save all button
    const saveAllBtn = document.getElementById('saveAllBtn');
    if (saveAllBtn) {
      const handler = () => this.saveAllSettings();
      saveAllBtn.addEventListener('click', handler);
      this.eventListeners.push({ element: saveAllBtn, event: 'click', handler });
    }
  }

  updateData(userProfile, preferences) {
    this.userProfile = userProfile;
    this.preferences = preferences;
  }

  populateForms() {
    this.populateProfileForm();
    this.populatePreferencesForm();
  }

  populateProfileForm() {
    const fields = [
      { id: 'firstName', value: this.userProfile.firstName },
      { id: 'lastName', value: this.userProfile.lastName },
      { id: 'email', value: this.userProfile.email },
      { id: 'phone', value: this.userProfile.phone },
      { id: 'timezone', value: this.userProfile.timezone }
    ];

    fields.forEach(field => {
      const element = document.getElementById(field.id);
      if (element && field.value) {
        element.value = field.value;
      }
    });
  }

  populatePreferencesForm() {
    // Working hours
    if (this.preferences.workingHours) {
      const workStart = document.getElementById('workStart');
      const workEnd = document.getElementById('workEnd');
      
      if (workStart) workStart.value = this.preferences.workingHours.start || '09:00';
      if (workEnd) workEnd.value = this.preferences.workingHours.end || '17:00';
    }

    // Work days
    if (this.preferences.workDays) {
      document.querySelectorAll('input[name="workDays"]').forEach(checkbox => {
        checkbox.checked = this.preferences.workDays.includes(checkbox.value);
      });
    }

    // Energy preferences
    if (this.preferences.energyPeaks) {
      document.querySelectorAll('input[name="energyPeaks"]').forEach(checkbox => {
        checkbox.checked = this.preferences.energyPeaks.includes(checkbox.value);
      });
    }

    // Break and focus preferences
    const breakDuration = document.getElementById('breakDuration');
    const focusBlocks = document.getElementById('focusBlocks');
    
    if (breakDuration && this.preferences.preferredBreakDuration) {
      breakDuration.value = this.preferences.preferredBreakDuration;
    }
    if (focusBlocks && this.preferences.focusBlockLength) {
      focusBlocks.value = this.preferences.focusBlockLength;
    }

    // Notification preferences
    if (this.preferences.notifications) {
      const notificationSettings = [
        'taskReminders', 'aiSuggestions', 'breakReminders', 'weeklyReports'
      ];
      
      notificationSettings.forEach(setting => {
        const element = document.getElementById(setting);
        if (element) {
          element.checked = this.preferences.notifications[setting] !== false;
        }
      });
    }
    
    // Update 2FA status
    const twoFactorToggle = document.getElementById('twoFactor');
    if (twoFactorToggle) {
      twoFactorToggle.checked = this.userProfile.twoFactorEnabled || false;
    }
  }

  async handleProfileUpdate(formData) {
    const updates = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      timezone: formData.get('timezone')
    };

    updates.name = `${updates.firstName} ${updates.lastName}`;

    try {
      await ApiService.updateUser(updates);
      this.userProfile = { ...this.userProfile, ...updates };
      
      // Update profile info display
      if (window.profilePage) {
        window.profilePage.updateProfileInfo();
      }
      
      NotificationService.show('Profile updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      NotificationService.show('Error updating profile. Please try again.', 'error');
    }
  }

  async handlePasswordUpdate(formData) {
    const currentPassword = formData.get('currentPassword');
    const newPassword = formData.get('newPassword');
    const confirmPassword = formData.get('confirmNewPassword');

    const validation = this.validatePasswordUpdate(currentPassword, newPassword, confirmPassword);
    if (!validation.isValid) {
      NotificationService.show(validation.message, 'error');
      return;
    }

    try {
      NotificationService.show('Password update functionality coming soon!', 'info');
      document.getElementById('securityForm')?.reset();
    } catch (error) {
      console.error('Error updating password:', error);
      NotificationService.show('Error updating password. Please try again.', 'error');
    }
  }

  validatePasswordUpdate(currentPassword, newPassword, confirmPassword) {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return { isValid: false, message: 'Please fill in all password fields.' };
    }

    if (newPassword !== confirmPassword) {
      return { isValid: false, message: 'New passwords do not match.' };
    }

    if (newPassword.length < 8) {
      return { isValid: false, message: 'New password must be at least 8 characters long.' };
    }

    return { isValid: true };
  }

  async handleWorkingHoursUpdate() {
    const workStart = document.getElementById('workStart')?.value;
    const workEnd = document.getElementById('workEnd')?.value;
    const workDays = Array.from(document.querySelectorAll('input[name="workDays"]:checked'))
      .map(cb => cb.value);

    const updatedPreferences = {
      ...this.preferences,
      workingHours: { start: workStart, end: workEnd },
      workDays: workDays
    };

    try {
      await ApiService.savePreferences(updatedPreferences);
      this.preferences = updatedPreferences;
      NotificationService.show('Working hours updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating working hours:', error);
      NotificationService.show('Error updating working hours. Please try again.', 'error');
    }
  }

  async handleEnergyPreferencesUpdate() {
    const energyPeaks = Array.from(document.querySelectorAll('input[name="energyPeaks"]:checked'))
      .map(cb => cb.value);
    const breakDuration = parseInt(document.getElementById('breakDuration')?.value || 15);
    const focusBlocks = parseInt(document.getElementById('focusBlocks')?.value || 60);

    const updatedPreferences = {
      ...this.preferences,
      energyPeaks: energyPeaks,
      preferredBreakDuration: breakDuration,
      focusBlockLength: focusBlocks
    };

    try {
      await ApiService.savePreferences(updatedPreferences);
      this.preferences = updatedPreferences;
      NotificationService.show('Energy preferences updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating energy preferences:', error);
      NotificationService.show('Error updating energy preferences. Please try again.', 'error');
    }
  }

  async saveAllSettings() {
    try {
      // Save profile updates
      const profileForm = document.getElementById('profileForm');
      if (profileForm) {
        await this.handleProfileUpdate(new FormData(profileForm));
      }

      // Save working hours
      await this.handleWorkingHoursUpdate();

      // Save energy preferences
      await this.handleEnergyPreferencesUpdate();

      // Save notification preferences
      const notifications = {
        taskReminders: document.getElementById('taskReminders')?.checked || false,
        aiSuggestions: document.getElementById('aiSuggestions')?.checked || false,
        breakReminders: document.getElementById('breakReminders')?.checked || false,
        weeklyReports: document.getElementById('weeklyReports')?.checked || false
      };

      const updatedPreferences = {
        ...this.preferences,
        notifications
      };

      await ApiService.savePreferences(updatedPreferences);
      this.preferences = updatedPreferences;

      NotificationService.show('All settings saved successfully!', 'success');

    } catch (error) {
      console.error('Error saving all settings:', error);
      NotificationService.show('Error saving some settings. Please try again.', 'error');
    }
  }

  destroy() {
    // Clean up event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }
}

/**
 * Integration Manager - Handles third-party integrations
 */
class IntegrationManager {
  constructor() {
    this.integrations = {};
  }

  updateIntegrations(integrations) {
    this.integrations = integrations;
  }

  updateUI() {
    this.updateGoogleCalendarStatus();
    this.updateNotionStatus();
  }

  updateGoogleCalendarStatus() {
    const googleCard = document.getElementById('googleCalendarCard');
    const googleStatus = document.getElementById('googleCalendarStatus');
    const googleActions = document.getElementById('googleCalendarActions');

    if (!googleCard || !googleStatus || !googleActions) return;

    if (this.integrations.googleCalendar) {
      googleCard.classList.add('connected');
      googleStatus.innerHTML = '<i class="fas fa-circle"></i> Connected';
      googleStatus.style.color = 'var(--success)';
      googleActions.innerHTML = '<button class="btn btn-outline btn-sm" data-action="disconnect-google-calendar">Disconnect</button>';
    } else {
      googleCard.classList.remove('connected');
      googleStatus.innerHTML = '<i class="fas fa-circle"></i> Not Connected';
      googleStatus.style.color = 'var(--gray-500)';
      googleActions.innerHTML = '<button class="btn btn-primary btn-sm" data-action="connect-google-calendar">Connect</button>';
    }
  }

  updateNotionStatus() {
    const notionCard = document.getElementById('notionCard');
    const notionStatus = document.getElementById('notionStatus');
    const notionActions = document.getElementById('notionActions');

    if (!notionCard || !notionStatus || !notionActions) return;

    if (this.integrations.notion) {
      notionCard.classList.add('connected');
      notionStatus.innerHTML = '<i class="fas fa-circle"></i> Connected';
      notionStatus.style.color = 'var(--success)';
      notionActions.innerHTML = '<button class="btn btn-outline btn-sm" data-action="disconnect-notion">Disconnect</button>';
    } else {
      notionCard.classList.remove('connected');
      notionStatus.innerHTML = '<i class="fas fa-circle"></i> Not Connected';
      notionStatus.style.color = 'var(--gray-500)';
      notionActions.innerHTML = '<button class="btn btn-primary btn-sm" data-action="connect-notion">Connect</button>';
    }
  }

  async connectGoogleCalendar(skipGuide = false) {
    try {
      if (!skipGuide && window.GoogleCalendarHelper) {
        window.GoogleCalendarHelper.showConnectionGuide();
        return;
      }

      NotificationService.show('Connecting to Google Calendar...', 'info');
      const authResponse = await ApiService.getCalendarAuthUrl();
      
      if (authResponse?.success && authResponse.authUrl) {
        window.location.href = authResponse.authUrl;
      } else {
        const message = authResponse?.message || 'Google Calendar integration is temporarily unavailable due to app verification.';
        NotificationService.show(message, 'info');
      }
    } catch (error) {
      console.error('Error getting calendar auth URL:', error);
      const message = error.message.includes('not configured') 
        ? 'Google Calendar integration is not configured. Please contact support.'
        : 'Google Calendar integration is temporarily unavailable due to Google\'s app verification process.';
      NotificationService.show(message, 'info');
    }
  }

  async disconnectGoogleCalendar() {
    const confirmed = await ConfirmationDialog.show(
      'Disconnect Google Calendar',
      'Are you sure you want to disconnect your Google Calendar? You will lose calendar sync functionality.',
      'Disconnect',
      'Cancel',
      'warning'
    );

    if (confirmed) {
      try {
        NotificationService.show('Disconnecting calendar...', 'info');
        await ApiService.disconnectIntegration('google-calendar');
        this.integrations.googleCalendar = false;
        this.updateUI();
        NotificationService.show('Google Calendar disconnected successfully!', 'success');
      } catch (error) {
        console.error('Error disconnecting calendar:', error);
        NotificationService.show('Error disconnecting calendar. Please contact support if this persists.', 'error');
      }
    }
  }
    
  async connectNotion() {
    try {
      NotificationService.show('Connecting to Notion...', 'info');
      const authResponse = await ApiService.getNotionAuthUrl();
      if (authResponse?.success && authResponse.authUrl) {
        window.location.href = authResponse.authUrl;
      } else {
        NotificationService.show(authResponse?.message || 'Notion integration is currently under development.', 'info');
      }
    } catch (error) {
      console.error('Error getting Notion auth URL:', error);
      NotificationService.show(error.message || 'Notion integration is currently under development.', 'info');
    }
  }
  
  async disconnectNotion() {
    const confirmed = await ConfirmationDialog.show(
      'Disconnect Notion',
      'Are you sure you want to disconnect your Notion workspace? You will lose task sync functionality.',
      'Disconnect',
      'Cancel',
      'warning'
    );

    if (confirmed) {
      try {
        NotificationService.show('Disconnecting Notion...', 'info');
        await ApiService.disconnectIntegration('notion');
        this.integrations.notion = false;
        this.updateUI();
        NotificationService.show('Notion disconnected successfully!', 'success');
      } catch (error) {
        console.error('Error disconnecting Notion:', error);
        NotificationService.show('Error disconnecting Notion. Please contact support if this persists.', 'error');
      }
    }
  }

  destroy() {
    // No specific cleanup needed for integration manager
  }
}

/**
 * Settings Manager - Handles user settings and data operations
 */
class SettingsManager {
  async toggle2FA(enabled) {
    try {
      if (enabled) {
        NotificationService.show('Enabling two-factor authentication...', 'info');
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/auth/enable-2fa`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        });
        
        const data = await response.json();
        if (data.success) {
          if (window.profilePage) {
            window.profilePage.state.userProfile.twoFactorEnabled = true;
          }
          NotificationService.show('Two-factor authentication enabled successfully!', 'success');
        } else {
          this.reset2FAToggle();
          NotificationService.show(data.message || 'Failed to enable 2FA', 'error');
        }
      } else {
        const confirmed = await ConfirmationDialog.show(
          'Disable Two-Factor Authentication',
          'Are you sure you want to disable 2FA? This will make your account less secure.',
          'Disable 2FA',
          'Cancel',
          'warning'
        );
        
        if (confirmed) {
          NotificationService.show('Disabling two-factor authentication...', 'info');
          const response = await fetch(`${API_CONFIG.BASE_URL}/api/auth/disable-2fa`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              'Content-Type': 'application/json'
            }
          });
          
          const data = await response.json();
          if (data.success) {
            if (window.profilePage) {
              window.profilePage.state.userProfile.twoFactorEnabled = false;
            }
            NotificationService.show('Two-factor authentication disabled.', 'success');
          } else {
            this.reset2FAToggle();
            NotificationService.show(data.message || 'Failed to disable 2FA', 'error');
          }
        } else {
          this.reset2FAToggle();
        }
      }
    } catch (error) {
      console.error('Error toggling 2FA:', error);
      this.reset2FAToggle();
      NotificationService.show('Error updating 2FA settings. Please try again.', 'error');
    }
  }

  reset2FAToggle() {
    const twoFactorToggle = document.getElementById('twoFactor');
    if (twoFactorToggle && window.profilePage) {
      twoFactorToggle.checked = window.profilePage.state.userProfile.twoFactorEnabled || false;
    }
  }

  async exportUserData() {
    try {
      const [tasks, chats, analytics, schedule] = await Promise.all([
        ApiService.getTasks().catch(() => ({ tasks: [] })),
        ApiService.getAIChats().catch(() => ({ chats: [] })),
        ApiService.getAnalytics().catch(() => ({})),
        ApiService.getSchedule().catch(() => ({ events: [] }))
      ]);

      const exportData = {
        profile: window.profilePage?.state.userProfile || {},
        preferences: window.profilePage?.state.preferences || {},
        tasks: tasks.tasks || [],
        aiChats: chats.chats || [],
        analytics: analytics,
        schedule: schedule,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      this.downloadJSON(exportData, `Zyntrain-data-${new Date().toISOString().split('T')[0]}.json`);
      NotificationService.show('Data exported successfully!', 'success');

    } catch (error) {
      console.error('Error exporting data:', error);
      NotificationService.show('Error exporting data. Please try again.', 'error');
    }
  }

  downloadJSON(data, filename) {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = Utils.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  shareWithFriends() {
    const shareData = {
      title: 'Zyntrain AI - AI-Powered Task Management',
      text: 'Check out Zyntrain AI! It uses AI to optimize your schedule and boost productivity. It\'s completely free!',
      url: 'https://zykro.devI'
    };

    if (navigator.share) {
      navigator.share(shareData).catch(console.error);
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`).then(() => {
        NotificationService.show('Share link copied to clipboard!', 'success');
      }).catch(() => {
        this.showShareModal(shareData);
      });
    }
  }

  showShareModal(shareData) {
    const modal = new ShareModal(shareData);
    modal.show();
  }

  destroy() {
    // No specific cleanup needed for settings manager
  }
}

/**
 * Share Modal - Handles social sharing functionality
 */
class ShareModal {
  constructor(shareData) {
    this.shareData = shareData;
  }

  show() {
    const modal = this.createModal();
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
    
    this.initEventListeners(modal);
  }

  createModal() {
    const modal = Utils.createElement('div', 'modal-overlay');
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Share Zyntrain AI</h3>
          <button class="modal-close" data-action="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <p>Help others discover Zyntrain AI!</p>
          <div class="share-options">
            <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(this.shareData.text)}&url=${encodeURIComponent(this.shareData.url)}" 
               target="_blank" class="share-btn twitter">
              <i class="fab fa-twitter"></i> Twitter
            </a>
            <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.shareData.url)}" 
               target="_blank" class="share-btn facebook">
              <i class="fab fa-facebook"></i> Facebook
            </a>
            <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(this.shareData.url)}" 
               target="_blank" class="share-btn linkedin">
              <i class="fab fa-linkedin"></i> LinkedIn
            </a>
          </div>
          <div class="share-link">
            <input type="text" value="${this.shareData.url}" readonly>
            <button class="btn btn-primary" data-action="copy-link" data-url="${this.shareData.url}">
              Copy Link
            </button>
          </div>
        </div>
      </div>
    `;
    return modal;
  }

  initEventListeners(modal) {
    modal.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'close-modal' || e.target === modal) {
        this.close(modal);
      } else if (action === 'copy-link') {
        const url = e.target.dataset.url;
        navigator.clipboard.writeText(url).then(() => {
          NotificationService.show('Link copied!', 'success');
          this.close(modal);
        });
      }
    });
  }

  close(modal) {
    modal.classList.remove('show');
    setTimeout(() => {
      if (modal.parentNode) {
        modal.remove();
      }
    }, 300);
  }
}

// Initialize profile page
const initProfilePage = () => {
  if (window.location.pathname.includes('profile.html')) {
    const profilePage = new ProfilePage();
    window.profilePage = profilePage;
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProfilePage);
} else {
  initProfilePage();
}

// Add enhanced styles
const profileStyles = document.createElement('style');
profileStyles.textContent = `
  .share-options {
    display: flex;
    gap: var(--space-3);
    margin: var(--space-4) 0;
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .share-btn {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-lg);
    text-decoration: none;
    font-weight: 500;
    transition: all var(--transition-fast);
    color: white;
    font-size: var(--text-sm);
  }
  
  .share-btn.twitter { background: #1da1f2; }
  .share-btn.facebook { background: #4267b2; }
  .share-btn.linkedin { background: #0077b5; }
  
  .share-btn:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    color: white;
    text-decoration: none;
  }
  
  .share-link {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }
  
  .share-link input {
    flex: 1;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--gray-300);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    background: var(--gray-50);
  }
`;
document.head.appendChild(profileStyles);

export { ProfilePage, ProfileFormManager, IntegrationManager, SettingsManager, ShareModal };