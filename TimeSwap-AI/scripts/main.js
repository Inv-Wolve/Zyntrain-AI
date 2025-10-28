/**
 * Main Application Entry Point
 * Handles core app initialization and global state management
 */

import { Utils } from './utils.js';
import { NotificationService } from './services/notification.js';
import { ThemeManager } from './services/theme.js';
import { ApiService } from './services/api.js';
import { AIService } from './services/ai.js';
import { ConfirmationDialog } from './components/confirmation-dialog.js';

class ZyntrainApp {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
    this.eventListeners = new Map();
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      this.initGlobalServices();
      this.initGlobalEventListeners();
      await this.checkAuthentication();
      this.initPageSpecificFeatures();
      this.isInitialized = true;
      
      console.log('Zyntrain App initialized successfully');
    } catch (error) {
      console.error('App initialization failed:', error);
      NotificationService.show('Application failed to initialize', 'error');
    }
  }

  initGlobalServices() {
    // Initialize theme management
    ThemeManager.init();
    
    // Set up global error handling
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      // Don't show notification for every error to avoid spam
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      event.preventDefault();
    });
  }

  initGlobalEventListeners() {
    // Logout functionality
    this.addGlobalEventListener('click', (e) => {
      if (e.target.matches('#logoutBtn, .logout')) {
        e.preventDefault();
        this.handleLogout();
      }
    });

    // Mobile navigation
    this.initMobileNavigation();
  }

  addGlobalEventListener(event, handler) {
    document.addEventListener(event, handler);
    this.eventListeners.set(handler, { event, handler });
  }

  initMobileNavigation() {
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (!navToggle || !navMenu) return;

    const toggleHandler = () => {
      const isActive = navMenu.classList.toggle('active');
      navToggle.classList.toggle('active', isActive);
      document.body.style.overflow = isActive ? 'hidden' : '';
    };

    navToggle.addEventListener('click', toggleHandler);

    // Close menu on outside click
    const outsideClickHandler = (e) => {
      if (navMenu.classList.contains('active') && 
          !navMenu.contains(e.target) && 
          !navToggle.contains(e.target)) {
        this.closeMobileMenu();
      }
    };

    document.addEventListener('click', outsideClickHandler);

    // Close menu on window resize
    const resizeHandler = Utils.debounce(() => {
      if (window.innerWidth > 768) {
        this.closeMobileMenu();
      }
    }, 250);

    window.addEventListener('resize', resizeHandler);
  }

  closeMobileMenu() {
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (navToggle) navToggle.classList.remove('active');
    if (navMenu) navMenu.classList.remove('active');
    document.body.style.overflow = '';
  }

  async checkAuthentication() {
    const token = localStorage.getItem('authToken');
    if (!token) {
      this.handleUnauthenticated();
      return;
    }

    try {
      const user = await ApiService.getCurrentUser();
      this.currentUser = user;
      this.handleAuthenticated();
    } catch (error) {
      console.warn('Authentication check failed:', error);
      localStorage.removeItem('authToken');
      this.handleUnauthenticated();
    }
  }

  handleAuthenticated() {
    const currentPage = this.getCurrentPage();
    if (currentPage === 'auth') {
      window.location.href = 'dashboard.html';
    }
  }

  handleUnauthenticated() {
    const currentPage = this.getCurrentPage();
    const protectedPages = ['dashboard', 'profile'];
    
    if (protectedPages.includes(currentPage)) {
      window.location.href = 'auth.html';
    }
  }

  getCurrentPage() {
    const path = window.location.pathname;
    if (path.includes('dashboard.html')) return 'dashboard';
    if (path.includes('profile.html')) return 'profile';
    if (path.includes('auth.html')) return 'auth';
    if (path.includes('faq.html')) return 'faq';
    return 'home';
  }

  initPageSpecificFeatures() {
    const page = this.getCurrentPage();
    
    const pageInitializers = {
      home: () => this.initHomeFeatures(),
      dashboard: () => this.initDashboardSidebar(),
      profile: () => this.initDashboardSidebar()
    };

    const initializer = pageInitializers[page];
    if (initializer) {
      initializer();
    }
  }

  initHomeFeatures() {
    this.initScrollEffects();
    this.initAnimations();
  }

  initScrollEffects() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    const updateNavbar = Utils.throttle(() => {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    }, 100);

    window.addEventListener('scroll', updateNavbar);

    // Smooth scrolling for anchor links
    this.addGlobalEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  initAnimations() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('.feature-card, .step, .pricing-card')
      .forEach(el => observer.observe(el));
  }

  initDashboardSidebar() {
    if (window.innerWidth > 1024) return;

    const sidebar = document.querySelector('.sidebar');
    const mainHeader = document.querySelector('.main-header');
    
    if (!sidebar || !mainHeader) return;

    // Create mobile menu button if it doesn't exist
    if (!mainHeader.querySelector('.mobile-menu-btn')) {
      const mobileMenuBtn = Utils.createElement('button', 'mobile-menu-btn', '<i class="fas fa-bars"></i>');
      mainHeader.appendChild(mobileMenuBtn);

      // Create overlay
      const overlay = Utils.createElement('div', 'sidebar-overlay');
      document.body.appendChild(overlay);

      // Event listeners
      mobileMenuBtn.addEventListener('click', () => this.toggleSidebar(sidebar, overlay));
      overlay.addEventListener('click', () => this.closeSidebar(sidebar, overlay));
      
      // Close on nav item click
      sidebar.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => this.closeSidebar(sidebar, overlay));
      });
    }
  }

  toggleSidebar(sidebar, overlay) {
    const isOpen = sidebar.classList.toggle('open');
    overlay.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  closeSidebar(sidebar, overlay) {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  async handleLogout() {
    const confirmed = await ConfirmationDialog.show(
      'Logout',
      'Are you sure you want to logout?',
      'Logout',
      'Cancel',
      'warning'
    );

    if (confirmed) {
      localStorage.removeItem('authToken');
      this.currentUser = null;
      NotificationService.show('Logged out successfully', 'success');
      
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    }
  }

  destroy() {
    // Clean up event listeners
    this.eventListeners.forEach(({ event, handler }) => {
      document.removeEventListener(event, handler);
    });
    this.eventListeners.clear();
  }
}

// Initialize app
const app = new ZyntrainApp();

// Global exports for backward compatibility
window.ZyntrainApp = ZyntrainApp;
window.DataService = ApiService;
window.AIService = AIService;
window.Utils = Utils;
window.NotificationService = NotificationService;
window.ThemeManager = ThemeManager;
window.ConfirmationDialog = ConfirmationDialog;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

export { ZyntrainApp, ApiService as DataService, AIService, Utils, NotificationService, ThemeManager, ConfirmationDialog };