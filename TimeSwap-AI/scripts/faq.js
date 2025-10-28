/**
 * FAQ Page Handler
 * Manages FAQ interactions, search, and filtering
 */

import { Utils } from './utils.js';

class FAQPage {
  constructor() {
    this.faqItems = [];
    this.currentCategory = 'all';
    this.searchTerm = '';
    this.eventListeners = [];
    
    this.init();
  }

  init() {
    this.initFAQItems();
    this.initEventListeners();
    this.initSearch();
    this.initCategoryFilter();
  }

  initFAQItems() {
    this.faqItems = Array.from(document.querySelectorAll('.faq-item'));
  }

  initEventListeners() {
    // FAQ toggle functionality
    this.faqItems.forEach(item => {
      const question = item.querySelector('.faq-question');
      if (question) {
        const handler = () => this.toggleFAQ(item);
        question.addEventListener('click', handler);
        this.eventListeners.push({ element: question, event: 'click', handler });
      }
    });
  }

  toggleFAQ(item) {
    const isActive = item.classList.contains('active');
    
    // Close all other items
    this.faqItems.forEach(otherItem => {
      if (otherItem !== item) {
        otherItem.classList.remove('active');
      }
    });
    
    // Toggle current item
    item.classList.toggle('active', !isActive);
  }

  initSearch() {
    const searchInput = document.getElementById('faqSearch');
    if (!searchInput) return;

    // Debounced search to improve performance
    const debouncedSearch = Utils.debounce((searchTerm) => {
      this.searchTerm = searchTerm.toLowerCase();
      this.filterFAQs();
    }, 300);

    const handler = (e) => debouncedSearch(e.target.value);
    searchInput.addEventListener('input', handler);
    this.eventListeners.push({ element: searchInput, event: 'input', handler });
  }

  initCategoryFilter() {
    const categoryBtns = document.querySelectorAll('.category-btn');
    
    categoryBtns.forEach(btn => {
      const handler = () => {
        this.setActiveCategory(btn);
        this.currentCategory = btn.dataset.category;
        this.filterFAQs();
        this.clearSearch();
      };

      btn.addEventListener('click', handler);
      this.eventListeners.push({ element: btn, event: 'click', handler });
    });
  }

  setActiveCategory(activeBtn) {
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    activeBtn.classList.add('active');
  }

  clearSearch() {
    const searchInput = document.getElementById('faqSearch');
    if (searchInput) {
      searchInput.value = '';
      this.searchTerm = '';
    }
  }

  filterFAQs() {
    let visibleCount = 0;

    this.faqItems.forEach(item => {
      const isVisible = this.shouldShowItem(item);
      item.classList.toggle('hidden', !isVisible);
      
      if (isVisible) {
        visibleCount++;
      }
    });

    this.updateNoResultsMessage(visibleCount === 0);
  }

  shouldShowItem(item) {
    // Category filter
    const categoryMatch = this.currentCategory === 'all' || 
                         item.dataset.category === this.currentCategory;

    // Search filter
    let searchMatch = true;
    if (this.searchTerm) {
      const question = item.querySelector('.faq-question h3')?.textContent.toLowerCase() || '';
      const answer = item.querySelector('.faq-answer p')?.textContent.toLowerCase() || '';
      searchMatch = question.includes(this.searchTerm) || answer.includes(this.searchTerm);
    }

    return categoryMatch && searchMatch;
  }

  updateNoResultsMessage(showMessage) {
    const faqList = document.getElementById('faqList');
    if (!faqList) return;

    // Remove existing no results message
    const existingMessage = faqList.querySelector('.no-results');
    if (existingMessage) {
      existingMessage.remove();
    }

    if (showMessage) {
      const noResultsHTML = this.createNoResultsHTML();
      faqList.insertAdjacentHTML('beforeend', noResultsHTML);
    }
  }

  createNoResultsHTML() {
    const message = this.searchTerm 
      ? 'No FAQs match your search terms'
      : 'No FAQs found in this category';
    
    const suggestion = this.searchTerm
      ? 'Try adjusting your search terms or browse by category'
      : 'Try selecting a different category or use the search function';

    return `
      <div class="no-results">
        <div class="empty-state">
          <i class="fas fa-search"></i>
          <h3>${message}</h3>
          <p>${suggestion}</p>
        </div>
      </div>
    `;
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
 * FAQ Search Enhancement
 */
class FAQSearchEnhancer {
  constructor(faqPage) {
    this.faqPage = faqPage;
    this.eventListeners = [];
    this.initAdvancedSearch();
  }

  initAdvancedSearch() {
    this.addSearchSuggestions();
    this.addKeyboardNavigation();
  }

  addSearchSuggestions() {
    const searchInput = document.getElementById('faqSearch');
    if (!searchInput) return;

    // Create suggestions container
    const suggestionsContainer = Utils.createElement('div', 'search-suggestions');
    suggestionsContainer.style.display = 'none';
    searchInput.parentNode.appendChild(suggestionsContainer);

    // Popular search terms
    const popularTerms = [
      'account', 'password', 'tasks', 'calendar', 'AI', 'sync', 
      'notifications', 'privacy', 'billing', 'integrations'
    ];

    const focusHandler = () => {
      if (!searchInput.value) {
        this.showSuggestions(suggestionsContainer, popularTerms, 'Popular searches:');
      }
    };

    const blurHandler = () => {
      // Delay hiding to allow clicking on suggestions
      setTimeout(() => {
        suggestionsContainer.style.display = 'none';
      }, 200);
    };

    searchInput.addEventListener('focus', focusHandler);
    searchInput.addEventListener('blur', blurHandler);
    
    this.eventListeners.push(
      { element: searchInput, event: 'focus', handler: focusHandler },
      { element: searchInput, event: 'blur', handler: blurHandler }
    );
  }

  showSuggestions(container, terms, title) {
    const suggestionsHTML = `
      <div class="suggestions-title">${title}</div>
      <div class="suggestions-list">
        ${terms.map(term => `
          <div class="suggestion-item" data-term="${term}">
            <i class="fas fa-search"></i>
            ${term}
          </div>
        `).join('')}
      </div>
    `;

    container.innerHTML = suggestionsHTML;
    container.style.display = 'block';

    // Add click handlers for suggestions
    container.querySelectorAll('.suggestion-item').forEach(item => {
      const handler = () => {
        const searchInput = document.getElementById('faqSearch');
        if (searchInput) {
          searchInput.value = item.dataset.term;
          searchInput.dispatchEvent(new Event('input'));
          container.style.display = 'none';
        }
      };

      item.addEventListener('click', handler);
      this.eventListeners.push({ element: item, event: 'click', handler });
    });
  }

  addKeyboardNavigation() {
    const searchInput = document.getElementById('faqSearch');
    if (!searchInput) return;

    const handler = (e) => {
      if (e.key === 'Escape') {
        searchInput.blur();
      }
    };

    searchInput.addEventListener('keydown', handler);
    this.eventListeners.push({ element: searchInput, event: 'keydown', handler });
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
 * FAQ Analytics - Track user interactions
 */
class FAQAnalytics {
  constructor() {
    this.interactions = [];
    this.eventListeners = [];
    this.initTracking();
  }

  initTracking() {
    // Track FAQ opens
    const clickHandler = (e) => {
      const faqQuestion = e.target.closest('.faq-question');
      if (faqQuestion) {
        const faqItem = faqQuestion.closest('.faq-item');
        const questionText = faqQuestion.querySelector('h3')?.textContent;
        
        this.trackInteraction('faq_opened', {
          question: questionText,
          category: faqItem?.dataset.category,
          timestamp: new Date().toISOString()
        });
      }
    };

    document.addEventListener('click', clickHandler);
    this.eventListeners.push({ element: document, event: 'click', handler: clickHandler });

    // Track search queries
    const searchInput = document.getElementById('faqSearch');
    if (searchInput) {
      const searchHandler = Utils.debounce((e) => {
        if (e.target.value.length > 2) {
          this.trackInteraction('faq_searched', {
            query: e.target.value,
            timestamp: new Date().toISOString()
          });
        }
      }, 1000);

      searchInput.addEventListener('input', searchHandler);
      this.eventListeners.push({ element: searchInput, event: 'input', handler: searchHandler });
    }
  }

  trackInteraction(event, data) {
    this.interactions.push({ event, data });
    
    // Keep only last 100 interactions to prevent memory issues
    if (this.interactions.length > 100) {
      this.interactions = this.interactions.slice(-100);
    }

    // In a real app, you might send this to an analytics service
    console.log('FAQ Analytics:', event, data);
  }

  getPopularQuestions() {
    const questionCounts = {};
    
    this.interactions
      .filter(interaction => interaction.event === 'faq_opened')
      .forEach(interaction => {
        const question = interaction.data.question;
        questionCounts[question] = (questionCounts[question] || 0) + 1;
      });

    return Object.entries(questionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([question, count]) => ({ question, count }));
  }

  destroy() {
    // Clean up event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }
}

// Initialize FAQ page
const initFAQPage = () => {
  if (window.location.pathname.includes('faq.html')) {
    const faqPage = new FAQPage();
    new FAQSearchEnhancer(faqPage);
    new FAQAnalytics();
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFAQPage);
} else {
  initFAQPage();
}

// Add FAQ-specific styles
const faqStyles = document.createElement('style');
faqStyles.textContent = `
  .no-results {
    text-align: center;
    padding: var(--space-12);
    color: var(--gray-500);
  }
  
  .no-results i {
    font-size: var(--font-size-4xl);
    margin-bottom: var(--space-4);
    color: var(--gray-400);
  }
  
  .no-results h3 {
    margin: 0 0 var(--space-2) 0;
    color: var(--gray-600);
  }
  
  .no-results p {
    margin: 0;
    font-size: var(--font-size-sm);
  }

  .search-suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid var(--gray-300);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 10;
    margin-top: 4px;
  }

  .suggestions-title {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--gray-500);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--gray-200);
  }

  .suggestions-list {
    max-height: 200px;
    overflow-y: auto;
  }

  .suggestion-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    transition: background-color 0.2s;
    font-size: var(--text-sm);
  }

  .suggestion-item:hover {
    background-color: var(--gray-50);
  }

  .suggestion-item i {
    color: var(--gray-400);
    font-size: var(--text-xs);
  }

  [data-theme="dark"] .search-suggestions {
    background: var(--gray-800);
    border-color: var(--gray-600);
  }

  [data-theme="dark"] .suggestions-title {
    color: var(--gray-400);
    border-bottom-color: var(--gray-600);
  }

  [data-theme="dark"] .suggestion-item:hover {
    background-color: var(--gray-700);
  }
`;
document.head.appendChild(faqStyles);

export { FAQPage, FAQSearchEnhancer, FAQAnalytics };