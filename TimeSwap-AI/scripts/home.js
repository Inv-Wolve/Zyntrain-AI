/**
 * Home Page Handler
 * Manages landing page interactions, animations, and effects
 */

import { Utils } from './utils.js';
import { ThemeManager } from './services/theme.js';

class HomePage {
  constructor() {
    this.particleSystem = null;
    this.animationFrameId = null;
    this.observers = [];
    this.eventListeners = [];
    
    this.init();
  }

  init() {
    this.initEventListeners();
    this.initAnimations();
    this.initParticleSystem();
    this.initScrollEffects();
    this.hideLoadingScreen();
  }

  initEventListeners() {
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      const handler = () => this.toggleTheme();
      themeToggle.addEventListener('click', handler);
      this.eventListeners.push({ element: themeToggle, event: 'click', handler });
    }

    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if (mobileMenuBtn) {
      const handler = () => this.toggleMobileMenu();
      mobileMenuBtn.addEventListener('click', handler);
      this.eventListeners.push({ element: mobileMenuBtn, event: 'click', handler });
    }

    // Window resize
    const resizeHandler = Utils.debounce(() => this.handleResize(), 250);
    window.addEventListener('resize', resizeHandler);
    this.eventListeners.push({ element: window, event: 'resize', handler: resizeHandler });

    // Smooth scrolling for navigation links
    this.initSmoothScrolling();
  }

  toggleTheme() {
    const newTheme = ThemeManager.toggleTheme();
    this.updateThemeIcon(newTheme);
    this.updateNavbarBackground();
  }

  updateThemeIcon(theme = ThemeManager.getCurrentTheme()) {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      const icon = themeToggle.querySelector('i');
      if (icon) {
        icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
      }
    }
  }

  toggleMobileMenu() {
    const navMenu = document.querySelector('.nav-menu');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    
    if (navMenu && mobileMenuBtn) {
      const isActive = navMenu.classList.toggle('active');
      mobileMenuBtn.classList.toggle('active', isActive);
      document.body.style.overflow = isActive ? 'hidden' : '';
    }
  }

  initSmoothScrolling() {
    const handler = (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      
      e.preventDefault();
      const targetId = link.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        const offsetTop = targetElement.offsetTop - 80; // Account for navbar
        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        });
      }
    };

    document.addEventListener('click', handler);
    this.eventListeners.push({ element: document, event: 'click', handler });
  }

  initAnimations() {
    this.initScrollAnimations();
    this.initCounterAnimations();
    this.initButtonEffects();
    this.initLoadingTextEffect();
  }

  initScrollAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate');
          
          // Add staggered animations for child elements
          const children = entry.target.querySelectorAll('.feature-card, .step, .benefit, .stat-card');
          children.forEach((child, index) => {
            setTimeout(() => {
              child.classList.add('animate');
              child.style.animationDelay = `${index * 0.1}s`;
            }, index * 100);
          });
        }
      });
    }, observerOptions);

    // Observe elements for animation
    const elementsToObserve = [
      ...document.querySelectorAll('.features, .how-it-works, .pricing, .stats'),
      ...document.querySelectorAll('.feature-card, .step, .pricing-card')
    ];

    elementsToObserve.forEach((element, index) => {
      element.style.transitionDelay = `${index * 0.1}s`;
      observer.observe(element);
    });

    this.observers.push(observer);
  }

  initCounterAnimations() {
    const counters = document.querySelectorAll('.stat-number');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.animateCounter(entry.target);
        }
      });
    });
    
    counters.forEach(counter => observer.observe(counter));
    this.observers.push(observer);
  }

  animateCounter(counter) {
    const target = counter.textContent;
    const isDecimal = target.includes('.');
    const hasPlus = target.includes('+');
    const hasX = target.includes('x');
    const hasK = target.includes('k');
    
    let numericTarget = parseFloat(target.replace(/[^\d.]/g, ''));
    let current = 0;
    const increment = numericTarget / 50;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= numericTarget) {
        current = numericTarget;
        clearInterval(timer);
      }
      
      let displayValue = isDecimal ? current.toFixed(1) : Math.floor(current);
      if (hasPlus && current >= numericTarget) displayValue += '+';
      if (hasX && current >= numericTarget) displayValue += 'x';
      if (hasK && current >= numericTarget) displayValue += 'k';
      
      counter.textContent = displayValue;
    }, 50);
  }

  initButtonEffects() {
    const buttons = document.querySelectorAll('button, .nav-btn');
    
    buttons.forEach(button => {
      const handler = (e) => this.createRippleEffect(e);
      button.addEventListener('mouseenter', handler);
      this.eventListeners.push({ element: button, event: 'mouseenter', handler });
    });
  }

  createRippleEffect(e) {
    const button = e.currentTarget;
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      transform: scale(0);
      animation: ripple-animation 0.6s linear;
      pointer-events: none;
    `;
    
    ripple.classList.add('ripple');
    button.style.position = 'relative';
    button.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
  }

  initLoadingTextEffect() {
    const loadingTexts = [
      'Initializing AI Engine...',
      'Loading Neural Networks...',
      'Calibrating Algorithms...',
      'Almost Ready...'
    ];
    
    const loadingTextElement = document.querySelector('.loading-text');
    if (!loadingTextElement) return;
    
    let currentTextIndex = 0;
    
    const typeText = (text, callback) => {
      let currentChar = 0;
      loadingTextElement.textContent = '';
      
      const typeInterval = setInterval(() => {
        loadingTextElement.textContent += text[currentChar];
        currentChar++;
        
        if (currentChar >= text.length) {
          clearInterval(typeInterval);
          setTimeout(callback, 800);
        }
      }, 100);
    };
    
    const cycleTexts = () => {
      if (currentTextIndex < loadingTexts.length) {
        typeText(loadingTexts[currentTextIndex], () => {
          currentTextIndex++;
          if (currentTextIndex < loadingTexts.length) {
            setTimeout(cycleTexts, 500);
          }
        });
      }
    };
    
    cycleTexts();
  }

  initParticleSystem() {
    const particlesBg = document.getElementById('particles-bg');
    if (!particlesBg) return;

    this.particleSystem = new ParticleSystem(particlesBg);
    this.particleSystem.init();
  }

  initScrollEffects() {
    this.initNavbarScrollEffect();
    this.initParallaxEffect();
    this.initDashboardInteraction();
  }

  initNavbarScrollEffect() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    
    const updateNavbar = Utils.throttle(() => {
      this.updateNavbarBackground();
    }, 100);

    const handler = () => updateNavbar();
    window.addEventListener('scroll', handler);
    this.eventListeners.push({ element: window, event: 'scroll', handler });
  }

  updateNavbarBackground() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    
    const currentTheme = ThemeManager.getCurrentTheme();
    const bgColor = currentTheme === 'light' 
      ? 'rgba(255, 255, 255, 0.98)' 
      : 'rgba(28, 28, 28, 0.98)';
    const bgColorDefault = currentTheme === 'light' 
      ? 'rgba(255, 255, 255, 0.95)' 
      : 'rgba(28, 28, 28, 0.95)';
        
    navbar.style.background = window.scrollY > 100 ? bgColor : bgColorDefault;
  }

  initParallaxEffect() {
    if (window.innerWidth <= 768) return; // Skip on mobile for performance
    
    const heroVisual = document.querySelector('.hero-visual');
    if (!heroVisual) return;
    
    const updateParallax = Utils.throttle(() => {
      const scrolled = window.pageYOffset;
      const rate = scrolled * -0.3;
      heroVisual.style.transform = `translateY(${rate}px)`;
    }, 16);
    
    const handler = () => updateParallax();
    window.addEventListener('scroll', handler);
    this.eventListeners.push({ element: window, event: 'scroll', handler });
  }

  initDashboardInteraction() {
    const dashboardPreview = document.querySelector('.dashboard-preview');
    const timelineItems = document.querySelectorAll('.timeline-item');
    
    if (!dashboardPreview || timelineItems.length === 0) return;
    
    const handler = () => {
      timelineItems.forEach((item, index) => {
        setTimeout(() => {
          item.classList.add('active');
          setTimeout(() => {
            item.classList.remove('active');
          }, 1000);
        }, index * 500);
      });
    };

    dashboardPreview.addEventListener('mouseenter', handler);
    this.eventListeners.push({ element: dashboardPreview, event: 'mouseenter', handler });
  }

  hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) return;
    
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 500);
    }, 2000);
  }

  handleResize() {
    // Recreate particle system with new dimensions
    if (this.particleSystem) {
      this.particleSystem.handleResize();
    }
    
    // Close mobile menu on desktop
    if (window.innerWidth > 768) {
      const navMenu = document.querySelector('.nav-menu');
      const mobileMenuBtn = document.getElementById('mobile-menu-btn');
      
      if (navMenu) navMenu.classList.remove('active');
      if (mobileMenuBtn) mobileMenuBtn.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  destroy() {
    // Clean up event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    // Clean up observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    // Clean up particle system
    if (this.particleSystem) {
      this.particleSystem.destroy();
      this.particleSystem = null;
    }

    // Cancel animation frames
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}

/**
 * Particle System - Creates animated background particles
 */
class ParticleSystem {
  constructor(container) {
    this.container = container;
    this.particles = [];
    this.animationId = null;
    this.isRunning = false;
  }

  init() {
    this.createParticles();
    this.start();
  }

  createParticles() {
    const particleCount = Math.min(50, Math.floor(window.innerWidth / 20));
    
    // Clear existing particles
    this.container.innerHTML = '';
    this.particles = [];

    for (let i = 0; i < particleCount; i++) {
      this.particles.push(new Particle(this.container));
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  animate() {
    if (!this.isRunning) return;
    
    this.particles.forEach(particle => particle.update());
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  handleResize() {
    this.stop();
    this.createParticles();
    this.start();
  }

  destroy() {
    this.stop();
    this.container.innerHTML = '';
    this.particles = [];
  }
}

/**
 * Individual Particle Class
 */
class Particle {
  constructor(container) {
    this.container = container;
    this.element = document.createElement('div');
    this.element.className = 'particle';
    this.reset();
    this.container.appendChild(this.element);
  }

  reset() {
    this.x = Math.random() * window.innerWidth;
    this.y = Math.random() * window.innerHeight;
    this.size = Math.random() * 4 + 1;
    this.speedX = (Math.random() - 0.5) * 2;
    this.speedY = (Math.random() - 0.5) * 2;
    this.opacity = Math.random() * 0.5 + 0.1;
    
    this.updateElement();
  }

  updateElement() {
    this.element.style.cssText = `
      left: ${this.x}px;
      top: ${this.y}px;
      width: ${this.size}px;
      height: ${this.size}px;
      opacity: ${this.opacity};
      position: absolute;
      background: currentColor;
      border-radius: 50%;
      pointer-events: none;
    `;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;

    // Wrap around screen edges
    if (this.x < 0) this.x = window.innerWidth;
    if (this.x > window.innerWidth) this.x = 0;
    if (this.y < 0) this.y = window.innerHeight;
    if (this.y > window.innerHeight) this.y = 0;

    this.updateElement();
  }
}

/**
 * Cinematic Effects System - Enhanced visual effects
 */
class CinematicEffects {
  constructor() {
    this.init();
  }

  init() {
    this.initPerformanceOptimizations();
    this.initAdvancedEffects();
  }

  initPerformanceOptimizations() {
    // Reduce animations on low-end devices
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
      document.body.classList.add('reduced-animations');
    }
    
    // Pause animations when tab is not visible
    document.addEventListener('visibilitychange', () => {
      document.body.classList.toggle('paused-animations', document.hidden);
    });
  }

  initAdvancedEffects() {
    // Enhanced hover effects for cards
    const cards = document.querySelectorAll('.card, .feature-card, .stat-card');
    cards.forEach(card => {
      card.addEventListener('mouseenter', (e) => {
        this.createAdvancedRipple(e.target, e);
      });
    });
    
    // Magnetic effect for buttons (desktop only)
    if (window.innerWidth > 1023) {
      this.initMagneticButtons();
    }
  }

  initMagneticButtons() {
    const buttons = document.querySelectorAll('.btn');
    
    buttons.forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        
        btn.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px) scale(1.05)`;
      });
      
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  createAdvancedRipple(element, event) {
    const ripple = document.createElement('div');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: radial-gradient(circle, rgba(0, 255, 255, 0.3) 0%, transparent 70%);
      border-radius: 50%;
      pointer-events: none;
      z-index: 0;
      animation: rippleEffect 0.6s ease-out;
    `;
    
    element.style.position = 'relative';
    element.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
  }
}

/**
 * Custom Cursor System
 */
class CustomCursor {
  constructor() {
    this.cursor = document.createElement('div');
    this.cursorDot = document.createElement('div');
    this.init();
  }

  init() {
    this.cursor.className = 'custom-cursor';
    this.cursorDot.className = 'custom-cursor-dot';
    document.body.appendChild(this.cursor);
    document.body.appendChild(this.cursorDot);

    document.addEventListener('mousemove', (e) => this.moveCursor(e));
    document.addEventListener('mousedown', () => this.cursor.classList.add('active'));
    document.addEventListener('mouseup', () => this.cursor.classList.remove('active'));
    
    // Hover effects
    const interactiveElements = document.querySelectorAll('a, button, .feature-card, .step');
    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', () => this.cursor.classList.add('hover'));
      el.addEventListener('mouseleave', () => this.cursor.classList.remove('hover'));
    });
  }

  moveCursor(e) {
    const { clientX, clientY } = e;
    this.cursorDot.style.transform = `translate(${clientX}px, ${clientY}px)`;
    
    // Smooth follow for outer circle
    requestAnimationFrame(() => {
      this.cursor.style.transform = `translate(${clientX}px, ${clientY}px)`;
    });
  }
}

// Initialize home page only if we're on the home page
const initHomePage = () => {
  const isHomePage = window.location.pathname === '/' || 
                     window.location.pathname.includes('index.html') || 
                     window.location.pathname === '';
  
  if (isHomePage) {
    new HomePage();
    new CinematicEffects();
    
    // Custom cursor disabled per user request
    // if (window.matchMedia('(pointer: fine)').matches) {
    //   new CustomCursor();
    // }
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHomePage);
} else {
  initHomePage();
}

// Add dynamic CSS animations
const homeStyles = document.createElement('style');
homeStyles.textContent = `
  .custom-cursor {
    position: fixed;
    top: 0;
    left: 0;
    width: 40px;
    height: 40px;
    border: 1px solid rgba(37, 99, 235, 0.5);
    border-radius: 50%;
    pointer-events: none;
    transform: translate(-50%, -50%);
    transition: width 0.3s, height 0.3s, background-color 0.3s;
    z-index: 9999;
    mix-blend-mode: difference;
    margin-left: -20px;
    margin-top: -20px;
  }
  
  .custom-cursor-dot {
    position: fixed;
    top: 0;
    left: 0;
    width: 8px;
    height: 8px;
    background-color: #2563eb;
    border-radius: 50%;
    pointer-events: none;
    z-index: 10000;
    margin-left: -4px;
    margin-top: -4px;
  }
  
  .custom-cursor.hover {
    width: 60px;
    height: 60px;
    background-color: rgba(37, 99, 235, 0.1);
    border-color: transparent;
    margin-left: -30px;
    margin-top: -30px;
  }
  
  .custom-cursor.active {
    transform: scale(0.8);
  }

  @keyframes rippleEffect {
    0% {
      transform: scale(0);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 0;
    }
  }
  
  @keyframes ripple-animation {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
  
  .reduced-animations * {
    animation-duration: 0.3s !important;
  }
  
  .paused-animations * {
    animation-play-state: paused !important;
  }
  
  .title-line {
    display: inline-block;
    animation: titleLineReveal 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    opacity: 0;
    transform: translateY(40px);
  }
  
  .title-line:nth-child(1) { animation-delay: 0.2s; }
  .title-line:nth-child(2) { animation-delay: 0.4s; }
  
  @keyframes titleLineReveal {
    0% {
      opacity: 0;
      transform: translateY(40px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .nav-menu.active {
    display: flex !important;
    position: fixed;
    top: 70px;
    left: 0;
    right: 0;
    background: var(--bg-primary);
    flex-direction: column;
    padding: var(--spacing-lg);
    box-shadow: 0 4px 20px var(--shadow-color);
    border-bottom: 1px solid var(--border-color);
  }
  
  .mobile-menu-btn.active span:nth-child(1) {
    transform: rotate(-45deg) translate(-5px, 6px);
  }
  
  .mobile-menu-btn.active span:nth-child(2) {
    opacity: 0;
  }
  
  .mobile-menu-btn.active span:nth-child(3) {
    transform: rotate(45deg) translate(-5px, -6px);
  }
`;
document.head.appendChild(homeStyles);

export { HomePage, ParticleSystem, CinematicEffects, CustomCursor };