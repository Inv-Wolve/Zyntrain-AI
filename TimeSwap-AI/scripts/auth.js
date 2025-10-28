/**
 * Authentication Page Handler
 * Manages login, registration, and password reset functionality
 */

import { Utils } from './utils.js';
import { NotificationService } from './services/notification.js';
import { ApiService } from './services/api.js';

class AuthPage {
  constructor() {
    this.currentForm = 'signin';
    this.validators = new FormValidators();
    this.eventListeners = [];
    
    this.init();
  }

  init() {
    this.initEventListeners();
    this.initFormValidation();
    this.initAnimations();
  }

  initEventListeners() {
    // Form switching and actions
    const clickHandler = (e) => {
      const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
      if (action) {
        e.preventDefault();
        this.handleAction(action, e.target);
      }
    };

    document.addEventListener('click', clickHandler);
    this.eventListeners.push({ element: document, event: 'click', handler: clickHandler });

    // Form submissions
    this.initFormSubmissions();
  }

  handleAction(action, element) {
    const actions = {
      'show-signup': () => this.switchForm('signup'),
      'show-signin': () => this.switchForm('signin'),
      'forgot-password': () => this.showForgotPasswordModal(),
      'toggle-2fa': () => this.handle2FAToggle(element)
    };

    const handler = actions[action];
    if (handler) {
      handler();
    }
  }

  switchForm(formType) {
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');

    if (!signInForm || !signUpForm) return;

    if (formType === 'signup') {
      signInForm.classList.add('hidden');
      signUpForm.classList.remove('hidden');
      this.currentForm = 'signup';
    } else {
      signUpForm.classList.add('hidden');
      signInForm.classList.remove('hidden');
      this.currentForm = 'signin';
    }
  }

  initFormSubmissions() {
    const forms = [
      { id: 'loginForm', handler: (formData) => this.handleLogin(formData) },
      { id: 'registerForm', handler: (formData) => this.handleRegister(formData) }
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
  }

  async handleLogin(formData) {
    const email = formData.get('email');
    const password = formData.get('password');

    if (!this.validators.validateLogin(email, password)) {
      return;
    }

    const submitBtn = document.querySelector('#loginForm button[type="submit"]');
    this.setLoadingState(submitBtn, true);

    try {
      const response = await ApiService.login(email, password);
      
      if (response.success) {
        if (response.requires2FA) {
          NotificationService.show('2FA code sent to your email', 'info');
          setTimeout(() => {
            window.location.href = `verify-2fa.html?userId=${encodeURIComponent(response.userId)}`;
          }, 1000);
        } else {
          localStorage.setItem('authToken', response.token);
          NotificationService.show('Login successful! Welcome back.', 'success');
          
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 1000);
        }
      } else {
        NotificationService.show(
          response.error || 'Invalid email or password. Please check your credentials.',
          'error'
        );
      }
    } catch (error) {
      console.error('Login error:', error);
      NotificationService.show(
        error.message || 'Login failed. Please try again.',
        'error'
      );
    } finally {
      this.setLoadingState(submitBtn, false);
    }
  }

  async handleRegister(formData) {
    const userData = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword')
    };

    if (!this.validators.validateRegistration(userData)) {
      return;
    }

    const submitBtn = document.querySelector('#registerForm button[type="submit"]');
    this.setLoadingState(submitBtn, true);

    try {
      // Remove confirmPassword before sending to server
      const { confirmPassword, ...registrationData } = userData;
      const response = await ApiService.register(registrationData);
      
      if (response.success) {
        localStorage.setItem('authToken', response.token);
        NotificationService.show('Account created successfully! Welcome to Zyntrain.', 'success');
        
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1000);
      } else {
        NotificationService.show(
          response.error || 'Registration failed. Please try again.',
          'error'
        );
      }
    } catch (error) {
      console.error('Registration error:', error);
      NotificationService.show(
        error.message || 'Registration failed. Please try again.',
        'error'
      );
    } finally {
      this.setLoadingState(submitBtn, false);
    }
  }

  showForgotPasswordModal() {
    const modal = new ForgotPasswordModal();
    modal.show();
  }

  handle2FAToggle(element) {
    const isEnabled = element.checked;
    
    if (window.profilePage?.toggle2FA) {
      window.profilePage.toggle2FA(isEnabled);
    } else {
      NotificationService.show(
        '2FA settings will be available in your profile after login.',
        'info'
      );
    }
  }

  setLoadingState(button, isLoading) {
    if (!button) return;
    
    button.classList.toggle('btn-loading', isLoading);
    button.disabled = isLoading;
  }

  initFormValidation() {
    // Real-time validation
    const inputs = document.querySelectorAll('input');
    
    inputs.forEach(input => {
      const blurHandler = () => this.validateField(input);
      const inputHandler = () => {
        if (input.classList.contains('input-error')) {
          this.validateField(input);
        }
      };

      input.addEventListener('blur', blurHandler);
      input.addEventListener('input', inputHandler);
      
      this.eventListeners.push(
        { element: input, event: 'blur', handler: blurHandler },
        { element: input, event: 'input', handler: inputHandler }
      );
    });
  }

  validateField(field) {
    const value = field.value.trim();
    const fieldName = field.name;
    
    // Clear existing error
    this.clearFieldError(field);
    
    const validationResult = this.validators.validateSingleField(fieldName, value, field.form);
    
    if (!validationResult.isValid) {
      this.showFieldError(field, validationResult.message);
    }
    
    return validationResult.isValid;
  }

  showFieldError(field, message) {
    field.classList.add('input-error');
    
    const errorDiv = Utils.createElement('div', 'error-message', 
      `<i class="fas fa-exclamation-circle"></i> ${message}`);
    field.parentNode.appendChild(errorDiv);
  }

  clearFieldError(field) {
    field.classList.remove('input-error');
    const existingError = field.parentNode.querySelector('.error-message');
    if (existingError) {
      existingError.remove();
    }
  }

  initAnimations() {
    // Animate form elements on load
    const formElements = document.querySelectorAll('.input-group, .form-options, .btn');
    formElements.forEach((element, index) => {
      element.style.opacity = '0';
      element.style.transform = 'translateY(20px)';
      element.style.transition = 'all 0.5s ease';
      
      setTimeout(() => {
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
      }, index * 100);
    });

    // Floating label effect
    this.initFloatingLabels();
  }

  initFloatingLabels() {
    const inputs = document.querySelectorAll('input');
    
    inputs.forEach(input => {
      const handleFocus = () => input.parentNode.classList.add('focused');
      const handleBlur = () => {
        if (!input.value) {
          input.parentNode.classList.remove('focused');
        }
      };

      input.addEventListener('focus', handleFocus);
      input.addEventListener('blur', handleBlur);
      
      this.eventListeners.push(
        { element: input, event: 'focus', handler: handleFocus },
        { element: input, event: 'blur', handler: handleBlur }
      );

      // Check if input has value on load
      if (input.value) {
        input.parentNode.classList.add('focused');
      }
    });
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
 * Form Validation Class
 */
class FormValidators {
  validateLogin(email, password) {
    this.clearAllErrors();
    let isValid = true;

    const validations = [
      {
        condition: !email,
        field: 'loginEmail',
        message: 'Email is required'
      },
      {
        condition: email && !Utils.validateEmail(email),
        field: 'loginEmail',
        message: 'Please enter a valid email'
      },
      {
        condition: !password,
        field: 'loginPassword',
        message: 'Password is required'
      },
      {
        condition: password && password.length < 6,
        field: 'loginPassword',
        message: 'Password must be at least 6 characters'
      }
    ];

    validations.forEach(({ condition, field, message }) => {
      if (condition) {
        this.showError(field, message);
        isValid = false;
      }
    });

    return isValid;
  }

  validateRegistration(userData) {
    this.clearAllErrors();
    let isValid = true;

    const validations = [
      { field: 'firstName', value: userData.firstName, message: 'First name is required' },
      { field: 'lastName', value: userData.lastName, message: 'Last name is required' },
      { 
        field: 'registerEmail', 
        value: userData.email, 
        message: 'Email is required',
        extraCheck: () => !Utils.validateEmail(userData.email) ? 'Please enter a valid email' : null
      },
      { 
        field: 'registerPassword', 
        value: userData.password, 
        message: 'Password is required',
        extraCheck: () => userData.password.length < 8 ? 'Password must be at least 8 characters' : null
      },
      {
        field: 'confirmPassword',
        value: userData.confirmPassword,
        message: 'Please confirm your password',
        extraCheck: () => userData.password !== userData.confirmPassword ? 'Passwords do not match' : null
      }
    ];

    validations.forEach(validation => {
      if (!validation.value) {
        this.showError(validation.field, validation.message);
        isValid = false;
      } else if (validation.extraCheck) {
        const extraError = validation.extraCheck();
        if (extraError) {
          this.showError(validation.field, extraError);
          isValid = false;
        }
      }
    });

    return isValid;
  }

  validateSingleField(fieldName, value, form) {
    const validations = {
      email: () => {
        if (!value) return { isValid: false, message: 'Email is required' };
        if (!Utils.validateEmail(value)) return { isValid: false, message: 'Please enter a valid email' };
        return { isValid: true };
      },
      password: () => {
        if (!value) return { isValid: false, message: 'Password is required' };
        if (value.length < 6) return { isValid: false, message: 'Password must be at least 6 characters' };
        return { isValid: true };
      },
      confirmPassword: () => {
        const password = form?.querySelector('input[name="password"]')?.value;
        if (password && value !== password) {
          return { isValid: false, message: 'Passwords do not match' };
        }
        return { isValid: true };
      },
      firstName: () => {
        if (!value) return { isValid: false, message: 'First name is required' };
        return { isValid: true };
      },
      lastName: () => {
        if (!value) return { isValid: false, message: 'Last name is required' };
        return { isValid: true };
      }
    };

    return validations[fieldName]?.() || { isValid: true };
  }

  showError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    field.classList.add('input-error');
    
    const existingError = field.parentNode.querySelector('.error-message');
    if (existingError) existingError.remove();
    
    const errorDiv = Utils.createElement('div', 'error-message',
      `<i class="fas fa-exclamation-circle"></i> ${message}`);
    field.parentNode.appendChild(errorDiv);
  }

  clearAllErrors() {
    document.querySelectorAll('.input-error').forEach(field => {
      field.classList.remove('input-error');
    });
    document.querySelectorAll('.error-message').forEach(error => {
      error.remove();
    });
  }
}

/**
 * Forgot Password Modal
 */
class ForgotPasswordModal {
  show() {
    const modal = this.createModal();
    document.body.appendChild(modal);
    
    setTimeout(() => modal.classList.add('show'), 10);
    
    this.initEventListeners(modal);
  }

  createModal() {
    const modal = Utils.createElement('div', 'modal-overlay forgot-modal');
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Reset Password</h3>
          <button class="modal-close" data-action="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-icon">
            <i class="fas fa-key"></i>
          </div>
          <p>Enter your email address and we'll send you instructions to reset your password.</p>
          <form id="forgotPasswordForm" class="form">
            <div class="input-group">
              <label for="resetEmail">Email Address</label>
              <input type="email" id="resetEmail" name="email" required>
            </div>
            <button type="submit" class="btn btn-primary btn-full">
              <i class="fas fa-paper-plane"></i>
              Send Reset Link
            </button>
          </form>
        </div>
      </div>
    `;
    return modal;
  }

  initEventListeners(modal) {
    // Form submission
    const form = modal.querySelector('#forgotPasswordForm');
    form.addEventListener('submit', (e) => this.handleSubmit(e, modal));
    
    // Close modal
    modal.addEventListener('click', (e) => {
      if (e.target.matches('[data-action="close-modal"]') || e.target === modal) {
        this.close(modal);
      }
    });
  }

  async handleSubmit(e, modal) {
    e.preventDefault();
    
    const email = e.target.querySelector('#resetEmail').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    submitBtn.classList.add('btn-loading');
    submitBtn.disabled = true;
    
    try {
      const response = await ApiService.requestPasswordReset(email);
      if (response.success) {
        NotificationService.show('Password reset email sent! Check your inbox.', 'success');
      } else {
        NotificationService.show(
          response.message || 'Error sending reset email. Please try again.',
          'error'
        );
      }
      this.close(modal);
    } catch (error) {
      console.error('Password reset error:', error);
      NotificationService.show(
        'Error sending reset email. Please contact support.',
        'error'
      );
      this.close(modal);
    } finally {
      submitBtn.classList.remove('btn-loading');
      submitBtn.disabled = false;
    }
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

/**
 * Google Calendar Helper
 */
class GoogleCalendarHelper {
  static showConnectionGuide() {
    const modal = new GoogleCalendarGuideModal();
    return modal.show();
  }
}

class GoogleCalendarGuideModal {
  show() {
    const modal = this.createModal();
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
    
    this.initEventListeners(modal);
    return modal;
  }

  createModal() {
    const modal = Utils.createElement('div', 'modal-overlay calendar-guide-modal');
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fab fa-google"></i> Connect Google Calendar</h3>
          <button class="modal-close" data-action="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="guide-content">
            ${this.createGuideSteps()}
          </div>
          <div class="security-note">
            <i class="fas fa-shield-alt"></i>
            <div>
              <strong>Your data is secure:</strong> We only access calendar data necessary for scheduling and never share it with third parties.
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-action="close-modal">Cancel</button>
          <button class="btn btn-primary" data-action="proceed-calendar">Continue to Google</button>
        </div>
      </div>
    `;
    return modal;
  }

  createGuideSteps() {
    const steps = [
      {
        number: 1,
        title: 'You may see a warning screen',
        description: 'Google shows "This app isn\'t verified" for new applications. This is normal and safe.'
      },
      {
        number: 2,
        title: 'Click "Advanced"',
        description: 'On the warning screen, click the "Advanced" link at the bottom.'
      },
      {
        number: 3,
        title: 'Click "Go to Zyntrain AI (unsafe)"',
        description: 'This allows you to proceed with the connection. Your data remains secure.'
      },
      {
        number: 4,
        title: 'Grant calendar permissions',
        description: 'Allow Zyntrain AI to read and manage your calendar events.'
      }
    ];

    return steps.map(step => `
      <div class="guide-step">
        <div class="step-number">${step.number}</div>
        <div class="step-content">
          <h4>${step.title}</h4>
          <p>${step.description}</p>
        </div>
      </div>
    `).join('');
  }

  initEventListeners(modal) {
    modal.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'close-modal' || e.target === modal) {
        this.close(modal);
      } else if (action === 'proceed-calendar') {
        this.close(modal);
        if (window.profilePage?.connectGoogleCalendar) {
          window.profilePage.connectGoogleCalendar(true);
        }
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

// Global exports
window.GoogleCalendarHelper = GoogleCalendarHelper;

// Initialize when DOM is loaded
const initAuthPage = () => {
  if (window.location.pathname.includes('auth.html')) {
    new AuthPage();
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthPage);
} else {
  initAuthPage();
}

// Add enhanced styles
const authStyles = document.createElement('style');
authStyles.textContent = `
  .input-group.focused label {
    transform: translateY(-24px) scale(0.9);
    color: var(--blue-600);
  }
  
  .input-group label {
    transition: all 0.3s ease;
    transform-origin: left top;
  }
  
  .auth-form {
    animation: slideInUp 0.6s ease-out;
  }
  
  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .btn-loading {
    position: relative;
    color: transparent !important;
    pointer-events: none;
  }
  
  .btn-loading::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to {
      transform: translate(-50%, -50%) rotate(360deg);
    }
  }
`;
document.head.appendChild(authStyles);

export { AuthPage, FormValidators, ForgotPasswordModal, GoogleCalendarHelper };