/**
 * Onboarding Survey System
 * Handles new user onboarding flow and preference collection
 */

import { Utils } from './utils.js';
import { NotificationService } from './services/notification.js';
import { ApiService } from './services/api.js';
import { ConfirmationDialog } from './components/confirmation-dialog.js';

class OnboardingSurvey {
  constructor() {
    this.state = {
      currentStep: 0,
      totalSteps: 5,
      surveyData: {},
      isNewUser: false
    };
    
    this.validators = new OnboardingValidators();
    this.eventListeners = [];
    
    this.init();
  }

  async init() {
    await this.checkIfNewUser();
  }

  async checkIfNewUser() {
    try {
      const [preferences, currentUser] = await Promise.all([
        ApiService.getPreferences().catch(() => ({})),
        ApiService.getCurrentUser().catch(() => null)
      ]);

      const hasCompletedOnboarding = preferences.onboardingCompleted || false;
      const isRecentUser = this.isRecentUser(currentUser);
      
      this.state.isNewUser = isRecentUser;

      if (this.state.isNewUser && !hasCompletedOnboarding) {
        setTimeout(() => this.showOnboarding(), 3000);
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    }
  }

  isRecentUser(user) {
    if (!user?.createdAt) return false;
    
    const createdAt = new Date(user.createdAt);
    const now = new Date();
    const timeDiff = (now - createdAt) / (1000 * 60); // minutes
    
    return timeDiff < 30; // User created within last 30 minutes
  }

  showOnboarding() {
    this.createModal();
    this.showStep(0);
  }

  createModal() {
    const modal = new OnboardingModal();
    const modalElement = modal.create();
    document.body.appendChild(modalElement);
    
    setTimeout(() => modalElement.classList.add('show'), 100);
    
    this.initEventListeners(modalElement);
  }

  initEventListeners(modal) {
    // Navigation buttons
    const nextBtn = modal.querySelector('#nextBtn');
    const backBtn = modal.querySelector('#backBtn');
    const skipBtn = modal.querySelector('#skipOnboarding');
    
    if (nextBtn) {
      const handler = () => this.nextStep();
      nextBtn.addEventListener('click', handler);
      this.eventListeners.push({ element: nextBtn, event: 'click', handler });
    }
    
    if (backBtn) {
      const handler = () => this.previousStep();
      backBtn.addEventListener('click', handler);
      this.eventListeners.push({ element: backBtn, event: 'click', handler });
    }
    
    if (skipBtn) {
      const handler = () => this.skipOnboarding();
      skipBtn.addEventListener('click', handler);
      this.eventListeners.push({ element: skipBtn, event: 'click', handler });
    }

    // Form interactions
    this.initFormInteractions(modal);
  }

  initFormInteractions(modal) {
    // Option selection handlers
    const optionCards = modal.querySelectorAll('.option-card');
    optionCards.forEach(card => {
      const handler = () => this.handleOptionCardClick(card);
      card.addEventListener('click', handler);
      this.eventListeners.push({ element: card, event: 'click', handler });
    });

    const checkboxOptions = modal.querySelectorAll('.checkbox-option');
    checkboxOptions.forEach(option => {
      const handler = () => this.handleCheckboxClick(option);
      option.addEventListener('click', handler);
      this.eventListeners.push({ element: option, event: 'click', handler });
    });

    // Slider handlers
    this.initSliders(modal);
  }

  handleOptionCardClick(card) {
    const input = card.querySelector('input[type="radio"]');
    if (!input) return;

    // Clear other selections in the same group
    const groupName = input.name;
    document.querySelectorAll(`input[name="${groupName}"]`).forEach(radio => {
      radio.closest('.option-card')?.classList.remove('selected');
    });
    
    // Select this option
    card.classList.add('selected');
    input.checked = true;
  }

  handleCheckboxClick(option) {
    const checkbox = option.querySelector('input[type="checkbox"]');
    if (!checkbox) return;

    checkbox.checked = !checkbox.checked;
    option.classList.toggle('selected', checkbox.checked);
  }

  initSliders(modal) {
    const sliders = [
      { id: 'breakDurationSlider', valueId: 'breakDurationValue', suffix: ' minutes' },
      { id: 'focusGoalSlider', valueId: 'focusGoalValue', suffix: ' hours', singular: ' hour' }
    ];

    sliders.forEach(({ id, valueId, suffix, singular }) => {
      const slider = modal.querySelector(`#${id}`);
      const valueDisplay = modal.querySelector(`#${valueId}`);
      
      if (slider && valueDisplay) {
        const handler = (e) => {
          const value = parseFloat(e.target.value);
          const displaySuffix = singular && value === 1 ? singular : suffix;
          valueDisplay.textContent = `${value}${displaySuffix}`;
        };

        slider.addEventListener('input', handler);
        this.eventListeners.push({ element: slider, event: 'input', handler });
      }
    });
  }

  showStep(stepIndex) {
    // Hide all steps
    document.querySelectorAll('.survey-step').forEach(step => {
      step.classList.remove('active');
    });

    // Show current step
    const stepId = stepIndex === this.state.totalSteps ? 'step-completion' : `step-${stepIndex}`;
    const currentStep = document.getElementById(stepId);
    if (currentStep) {
      currentStep.classList.add('active');
    }

    this.updateProgress(stepIndex);
    this.updateNavigationButtons(stepIndex);
    this.state.currentStep = stepIndex;
  }

  updateProgress(stepIndex) {
    const percentage = (stepIndex / this.state.totalSteps) * 100;
    
    const progressFill = document.getElementById('surveyProgressFill');
    const progressPercentage = document.getElementById('progressPercentage');
    const currentStepText = document.getElementById('currentStepText');
    
    if (progressFill) progressFill.style.width = `${percentage}%`;
    if (progressPercentage) progressPercentage.textContent = `${Math.round(percentage)}%`;
    if (currentStepText) {
      currentStepText.textContent = stepIndex === this.state.totalSteps 
        ? 'Complete!' 
        : `Step ${stepIndex + 1} of ${this.state.totalSteps}`;
    }
  }

  updateNavigationButtons(stepIndex) {
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    // Back button
    if (backBtn) {
      backBtn.disabled = stepIndex === 0;
      backBtn.style.display = 'flex';
    }
    
    // Next button
    if (nextBtn) {
      nextBtn.style.display = 'flex';
      
      const buttonConfigs = {
        0: { text: 'Get Started <i class="fas fa-arrow-right"></i>', class: 'btn btn-primary btn-next' },
        [this.state.totalSteps - 1]: { text: 'Complete Setup <i class="fas fa-check"></i>', class: 'btn btn-primary btn-finish' },
        [this.state.totalSteps]: { text: 'Start Using Zyntrain <i class="fas fa-rocket"></i>', class: 'btn btn-primary btn-finish' }
      };

      const config = buttonConfigs[stepIndex] || { 
        text: 'Next <i class="fas fa-arrow-right"></i>', 
        class: 'btn btn-primary btn-next' 
      };

      nextBtn.innerHTML = config.text;
      nextBtn.className = config.class;
    }
  }

  nextStep() {
    if (this.state.currentStep === this.state.totalSteps) {
      this.finishOnboarding();
      return;
    }

    if (!this.validators.validateStep(this.state.currentStep)) {
      return;
    }

    this.collectStepData();

    if (this.state.currentStep === this.state.totalSteps - 1) {
      this.showCompletionSummary();
      this.showStep(this.state.totalSteps);
    } else {
      this.showStep(this.state.currentStep + 1);
    }
  }

  previousStep() {
    if (this.state.currentStep > 0) {
      this.showStep(this.state.currentStep - 1);
    }
  }

  collectStepData() {
    const collectors = {
      1: () => this.collectWorkingHours(),
      2: () => this.collectEnergyPatterns(),
      3: () => this.collectWorkPreferences(),
      4: () => this.collectGoals(),
      5: () => this.collectNotifications()
    };

    const collector = collectors[this.state.currentStep];
    if (collector) {
      collector();
    }
  }

  collectWorkingHours() {
    this.state.surveyData.workingHours = {
      start: document.getElementById('workStartTime')?.value,
      end: document.getElementById('workEndTime')?.value
    };
    
    this.state.surveyData.workDays = Array.from(
      document.querySelectorAll('#step-1 .checkbox-option input[type="checkbox"]:checked')
    ).map(cb => cb.value);
  }

  collectEnergyPatterns() {
    this.state.surveyData.energyPeaks = Array.from(
      document.querySelectorAll('#step-2 .checkbox-option input[type="checkbox"]:checked')
    ).map(cb => cb.value);
  }

  collectWorkPreferences() {
    const focusLength = document.querySelector('input[name="focusLength"]:checked');
    this.state.surveyData.focusBlockLength = parseInt(focusLength?.value || 60);
    this.state.surveyData.preferredBreakDuration = parseInt(
      document.getElementById('breakDurationSlider')?.value || 15
    );
  }

  collectGoals() {
    this.state.surveyData.taskCategories = Array.from(
      document.querySelectorAll('#step-4 .checkbox-option input[type="checkbox"]:checked')
    ).map(cb => cb.value);
    
    this.state.surveyData.dailyFocusTimeGoal = parseFloat(
      document.getElementById('focusGoalSlider')?.value || 2
    );
  }

  collectNotifications() {
    this.state.surveyData.notifications = {};
    document.querySelectorAll('#step-5 .checkbox-option input[type="checkbox"]').forEach(checkbox => {
      this.state.surveyData.notifications[checkbox.value] = checkbox.checked;
    });
  }

  showCompletionSummary() {
    const summaryUpdater = new SummaryUpdater(this.state.surveyData);
    summaryUpdater.updateDisplay();
  }

  async finishOnboarding() {
    const loadingManager = new LoadingManager();
    loadingManager.show();

    try {
      const preferences = this.buildPreferences();
      
      await Promise.all([
        ApiService.updateUser({ onboardingCompleted: true }).catch(console.warn),
        ApiService.savePreferences(preferences)
      ]);
      
      NotificationService.show('Welcome to Zyntrain AI! Your preferences have been saved.', 'success');
      
      setTimeout(() => {
        this.closeOnboarding();
        this.refreshDashboard();
      }, 1500);

    } catch (error) {
      console.error('Error saving onboarding preferences:', error);
      NotificationService.show(
        'Error saving preferences. You can set them up later in your profile.', 
        'warning'
      );
      
      setTimeout(() => this.closeOnboarding(), 2000);
    }
  }

  buildPreferences() {
    return {
      workingHours: this.state.surveyData.workingHours,
      energyPeaks: this.state.surveyData.energyPeaks,
      preferredBreakDuration: this.state.surveyData.preferredBreakDuration,
      focusBlockLength: this.state.surveyData.focusBlockLength,
      workDays: this.state.surveyData.workDays,
      taskCategories: this.state.surveyData.taskCategories,
      notifications: this.state.surveyData.notifications,
      goals: {
        dailyFocusTime: this.state.surveyData.dailyFocusTimeGoal,
        weeklyTaskTarget: 20,
        productivityTarget: 80
      },
      onboardingCompleted: true,
      onboardingCompletedAt: new Date().toISOString()
    };
  }

  async skipOnboarding() {
    const confirmed = await ConfirmationDialog.show(
      'Skip Setup',
      'Are you sure you want to skip the setup? You can always configure these settings later in your profile.',
      'Skip Setup',
      'Continue Setup',
      'warning'
    );
    
    if (confirmed) {
      try {
        const defaultPreferences = this.buildDefaultPreferences();
        
        await Promise.all([
          ApiService.updateUser({ onboardingCompleted: true }).catch(console.warn),
          ApiService.savePreferences(defaultPreferences)
        ]);
        
        NotificationService.show(
          'Setup skipped. You can configure preferences anytime in your profile.', 
          'info'
        );
        this.closeOnboarding();
      } catch (error) {
        console.error('Error skipping onboarding:', error);
        this.closeOnboarding();
      }
    }
  }

  buildDefaultPreferences() {
    return {
      onboardingCompleted: true,
      onboardingSkipped: true,
      onboardingCompletedAt: new Date().toISOString(),
      workingHours: { start: '09:00', end: '17:00' },
      energyPeaks: ['morning'],
      preferredBreakDuration: 15,
      focusBlockLength: 60,
      workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      taskCategories: ['work', 'personal'],
      notifications: {
        taskReminders: true,
        aiSuggestions: true,
        breakReminders: true,
        weeklyReports: true
      },
      goals: {
        dailyFocusTime: 2,
        weeklyTaskTarget: 20,
        productivityTarget: 80
      }
    };
  }

  closeOnboarding() {
    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 300);
    }
  }

  refreshDashboard() {
    if (window.dashboard) {
      window.dashboard.loadData().then(() => {
        window.dashboard.updateUI();
      }).catch(console.warn);
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
 * Onboarding Modal Creator
 */
class OnboardingModal {
  create() {
    const modal = Utils.createElement('div', 'onboarding-overlay');
    modal.id = 'onboardingOverlay';
    modal.innerHTML = this.getModalHTML();
    return modal;
  }

  getModalHTML() {
    return `
      <div class="onboarding-modal">
        <div class="onboarding-header">
          <div class="onboarding-icon">
            <i class="fas fa-rocket"></i>
          </div>
          <h2>Welcome to Zyntrain AI!</h2>
          <p>Let's personalize your experience with a quick setup</p>
        </div>
        
        <div class="onboarding-content">
          ${this.getProgressHTML()}
          ${this.getStepsHTML()}
          ${this.getLoadingHTML()}
        </div>
        
        ${this.getActionsHTML()}
      </div>
    `;
  }

  getProgressHTML() {
    return `
      <div class="survey-progress">
        <div class="progress-info">
          <div class="progress-icon">
            <i class="fas fa-user-cog"></i>
          </div>
          <div class="progress-text">
            <span id="currentStepText">Step 1 of 5</span>
          </div>
        </div>
        <div class="progress-bar-container">
          <div class="survey-progress-bar">
            <div class="survey-progress-fill" id="surveyProgressFill"></div>
          </div>
        </div>
        <div class="progress-percentage" id="progressPercentage">0%</div>
      </div>
    `;
  }

  getStepsHTML() {
    const stepCreator = new OnboardingStepCreator();
    return stepCreator.createAllSteps();
  }

  getLoadingHTML() {
    return `
      <div class="loading-state" id="loadingState">
        <div class="loading-spinner"></div>
        <div class="loading-text">Saving your preferences...</div>
      </div>
    `;
  }

  getActionsHTML() {
    return `
      <div class="onboarding-actions">
        <div class="action-left">
          <button class="btn-skip" id="skipOnboarding">
            <i class="fas fa-times"></i>
            Skip Setup
          </button>
        </div>
        <div class="action-right">
          <button class="btn btn-secondary btn-back" id="backBtn" disabled>
            <i class="fas fa-arrow-left"></i>
            Back
          </button>
          <button class="btn btn-primary btn-next" id="nextBtn">
            Get Started
            <i class="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    `;
  }
}

/**
 * Onboarding Step Creator
 */
class OnboardingStepCreator {
  createAllSteps() {
    return [
      this.createWelcomeStep(),
      this.createWorkingHoursStep(),
      this.createEnergyStep(),
      this.createPreferencesStep(),
      this.createGoalsStep(),
      this.createNotificationsStep(),
      this.createCompletionStep()
    ].join('');
  }

  createWelcomeStep() {
    return `
      <div class="survey-step active" id="step-0">
        <div class="welcome-step">
          <div class="welcome-icon">
            <i class="fas fa-brain"></i>
          </div>
          <h3>Let's Get You Started!</h3>
          <p>We'll ask you a few quick questions to personalize Zyntrain AI for your workflow. This will help our AI provide better recommendations and optimize your schedule more effectively.</p>
          <div class="welcome-benefits">
            <div class="benefit-item">
              <div class="benefit-icon"><i class="fas fa-clock"></i></div>
              <div class="benefit-text">Smart Scheduling</div>
            </div>
            <div class="benefit-item">
              <div class="benefit-icon"><i class="fas fa-bolt"></i></div>
              <div class="benefit-text">Energy Optimization</div>
            </div>
            <div class="benefit-item">
              <div class="benefit-icon"><i class="fas fa-target"></i></div>
              <div class="benefit-text">Goal Tracking</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  createWorkingHoursStep() {
    return `
      <div class="survey-step" id="step-1">
        <div class="step-header">
          <h3 class="step-title">What are your typical working hours?</h3>
          <p class="step-description">This helps us schedule tasks during your productive hours and avoid interrupting your personal time.</p>
        </div>
        
        <div class="survey-question">
          <label class="question-label">Working Hours <span class="question-required">*</span></label>
          <div class="time-input-group">
            <div class="input-group">
              <label for="workStartTime">Start Time</label>
              <input type="time" id="workStartTime" value="09:00" required>
            </div>
            <div class="input-group">
              <label for="workEndTime">End Time</label>
              <input type="time" id="workEndTime" value="17:00" required>
            </div>
          </div>
        </div>

        <div class="survey-question">
          <label class="question-label">Which days do you typically work? <span class="question-required">*</span></label>
          <div class="checkbox-grid">
            ${this.createWorkDaysOptions()}
          </div>
        </div>
      </div>
    `;
  }

  createWorkDaysOptions() {
    const days = [
      { value: 'monday', label: 'Monday', checked: true },
      { value: 'tuesday', label: 'Tuesday', checked: true },
      { value: 'wednesday', label: 'Wednesday', checked: true },
      { value: 'thursday', label: 'Thursday', checked: true },
      { value: 'friday', label: 'Friday', checked: true },
      { value: 'saturday', label: 'Saturday', checked: false },
      { value: 'sunday', label: 'Sunday', checked: false }
    ];

    return days.map(day => `
      <div class="checkbox-option" data-value="${day.value}">
        <input type="checkbox" id="${day.value}" value="${day.value}" ${day.checked ? 'checked' : ''}>
        <div class="option-icon"><i class="fas fa-calendar-day"></i></div>
        <div class="option-title">${day.label}</div>
      </div>
    `).join('');
  }

  createEnergyStep() {
    return `
      <div class="survey-step" id="step-2">
        <div class="step-header">
          <h3 class="step-title">When do you feel most energetic?</h3>
          <p class="step-description">Understanding your energy patterns helps us schedule demanding tasks when you're at your peak performance.</p>
        </div>
        
        <div class="survey-question">
          <label class="question-label">Peak Energy Times <span class="question-required">*</span></label>
          <div class="checkbox-grid">
            ${this.createEnergyOptions()}
          </div>
        </div>
      </div>
    `;
  }

  createEnergyOptions() {
    const energyTimes = [
      { value: 'early-morning', label: 'Early Morning', description: '6AM - 9AM', icon: 'sunrise' },
      { value: 'morning', label: 'Morning', description: '9AM - 12PM', icon: 'sun', checked: true },
      { value: 'afternoon', label: 'Afternoon', description: '12PM - 5PM', icon: 'cloud-sun' },
      { value: 'evening', label: 'Evening', description: '5PM - 9PM', icon: 'moon' },
      { value: 'night', label: 'Night', description: '9PM - 12AM', icon: 'star' }
    ];

    return energyTimes.map(time => `
      <div class="checkbox-option" data-value="${time.value}">
        <input type="checkbox" id="${time.value}" value="${time.value}" ${time.checked ? 'checked' : ''}>
        <div class="option-icon"><i class="fas fa-${time.icon}"></i></div>
        <div class="option-title">${time.label}</div>
        <div class="option-description">${time.description}</div>
      </div>
    `).join('');
  }

  createPreferencesStep() {
    return `
      <div class="survey-step" id="step-3">
        <div class="step-header">
          <h3 class="step-title">How do you prefer to work?</h3>
          <p class="step-description">These preferences help us optimize your task scheduling and break recommendations.</p>
        </div>
        
        <div class="survey-question">
          <label class="question-label">Preferred Focus Block Length <span class="question-required">*</span></label>
          <div class="option-grid">
            ${this.createFocusOptions()}
          </div>
        </div>

        <div class="survey-question">
          <label class="question-label">Preferred Break Duration</label>
          <div class="slider-group">
            <div class="slider-label">
              <span>Break Length</span>
              <span class="slider-value" id="breakDurationValue">15 minutes</span>
            </div>
            <input type="range" class="range-slider" id="breakDurationSlider" 
                   min="5" max="30" value="15" step="5">
          </div>
        </div>
      </div>
    `;
  }

  createFocusOptions() {
    const focusOptions = [
      { value: '25', title: '25 Minutes', description: 'Pomodoro Technique', icon: 'stopwatch' },
      { value: '45', title: '45 Minutes', description: 'Balanced Focus', icon: 'clock' },
      { value: '60', title: '60 Minutes', description: 'Deep Work', icon: 'hourglass-half', checked: true },
      { value: '90', title: '90 Minutes', description: 'Extended Focus', icon: 'hourglass' }
    ];

    return focusOptions.map(option => `
      <div class="option-card" data-value="${option.value}">
        <input type="radio" name="focusLength" value="${option.value}" ${option.checked ? 'checked' : ''}>
        <div class="option-icon"><i class="fas fa-${option.icon}"></i></div>
        <div class="option-title">${option.title}</div>
        <div class="option-description">${option.description}</div>
      </div>
    `).join('');
  }

  createGoalsStep() {
    return `
      <div class="survey-step" id="step-4">
        <div class="step-header">
          <h3 class="step-title">What are your main goals?</h3>
          <p class="step-description">Help us understand what you want to achieve so we can provide relevant suggestions and track your progress.</p>
        </div>
        
        <div class="survey-question">
          <label class="question-label">Primary Work Categories <span class="question-required">*</span></label>
          <div class="checkbox-grid">
            ${this.createCategoryOptions()}
          </div>
        </div>

        <div class="survey-question">
          <label class="question-label">Daily Focus Time Goal</label>
          <div class="slider-group">
            <div class="slider-label">
              <span>Target Hours</span>
              <span class="slider-value" id="focusGoalValue">2 hours</span>
            </div>
            <input type="range" class="range-slider" id="focusGoalSlider" 
                   min="1" max="8" value="2" step="0.5">
          </div>
        </div>
      </div>
    `;
  }

  createCategoryOptions() {
    const categories = [
      { value: 'work', label: 'Work', icon: 'briefcase', checked: true },
      { value: 'personal', label: 'Personal', icon: 'home', checked: true },
      { value: 'health', label: 'Health', icon: 'heart' },
      { value: 'learning', label: 'Learning', icon: 'graduation-cap' },
      { value: 'creative', label: 'Creative', icon: 'palette' },
      { value: 'social', label: 'Social', icon: 'users' }
    ];

    return categories.map(category => `
      <div class="checkbox-option" data-value="${category.value}">
        <input type="checkbox" id="cat-${category.value}" value="${category.value}" ${category.checked ? 'checked' : ''}>
        <div class="option-icon"><i class="fas fa-${category.icon}"></i></div>
        <div class="option-title">${category.label}</div>
      </div>
    `).join('');
  }

  createNotificationsStep() {
    return `
      <div class="survey-step" id="step-5">
        <div class="step-header">
          <h3 class="step-title">How would you like to be notified?</h3>
          <p class="step-description">Customize your notification preferences to stay informed without being overwhelmed.</p>
        </div>
        
        <div class="survey-question">
          <label class="question-label">Notification Preferences</label>
          <div class="checkbox-grid">
            ${this.createNotificationOptions()}
          </div>
        </div>
      </div>
    `;
  }

  createNotificationOptions() {
    const notifications = [
      { value: 'taskReminders', title: 'Task Reminders', description: 'Upcoming deadlines', icon: 'bell', checked: true },
      { value: 'aiSuggestions', title: 'AI Suggestions', description: 'Smart recommendations', icon: 'brain', checked: true },
      { value: 'breakReminders', title: 'Break Reminders', description: 'Rest notifications', icon: 'coffee', checked: true },
      { value: 'weeklyReports', title: 'Weekly Reports', description: 'Progress summaries', icon: 'chart-line', checked: true }
    ];

    return notifications.map(notif => `
      <div class="checkbox-option" data-value="${notif.value}">
        <input type="checkbox" id="notif-${notif.value}" value="${notif.value}" ${notif.checked ? 'checked' : ''}>
        <div class="option-icon"><i class="fas fa-${notif.icon}"></i></div>
        <div class="option-title">${notif.title}</div>
        <div class="option-description">${notif.description}</div>
      </div>
    `).join('');
  }

  createCompletionStep() {
    return `
      <div class="survey-step" id="step-completion">
        <div class="completion-step">
          <div class="completion-icon">
            <i class="fas fa-check"></i>
          </div>
          <h3>Setup Complete!</h3>
          <p>Great! We've personalized Zyntrain AI based on your preferences. Here's what we've configured:</p>
          
          <div class="completion-summary">
            <div class="summary-title">Your Personalized Settings</div>
            <div class="summary-item">
              <span class="summary-label">Working Hours:</span>
              <span class="summary-value" id="summaryWorkingHours">9:00 AM - 5:00 PM</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Work Days:</span>
              <span class="summary-value" id="summaryWorkDays">Mon-Fri</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Peak Energy:</span>
              <span class="summary-value" id="summaryEnergyPeaks">Morning</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Focus Blocks:</span>
              <span class="summary-value" id="summaryFocusLength">60 minutes</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Daily Goal:</span>
              <span class="summary-value" id="summaryFocusGoal">2 hours</span>
            </div>
          </div>
          
          <p>You can always change these settings later in your profile preferences.</p>
        </div>
      </div>
    `;
  }
}

/**
 * Onboarding Validators
 */
class OnboardingValidators {
  validateStep(stepIndex) {
    const validators = {
      1: () => this.validateWorkingHours(),
      2: () => this.validateEnergyPatterns(),
      3: () => this.validateWorkPreferences(),
      4: () => this.validateGoals()
    };

    const validator = validators[stepIndex];
    return validator ? validator() : true;
  }

  validateWorkingHours() {
    const workStart = document.getElementById('workStartTime')?.value;
    const workEnd = document.getElementById('workEndTime')?.value;
    const selectedDays = document.querySelectorAll('#step-1 .checkbox-option input[type="checkbox"]:checked');
    
    if (!workStart || !workEnd) {
      NotificationService.show('Please select your working hours', 'error');
      return false;
    }
    
    if (selectedDays.length === 0) {
      NotificationService.show('Please select at least one working day', 'error');
      return false;
    }
    
    return true;
  }

  validateEnergyPatterns() {
    const selectedEnergy = document.querySelectorAll('#step-2 .checkbox-option input[type="checkbox"]:checked');
    if (selectedEnergy.length === 0) {
      NotificationService.show('Please select at least one peak energy time', 'error');
      return false;
    }
    return true;
  }

  validateWorkPreferences() {
    const focusLength = document.querySelector('input[name="focusLength"]:checked');
    if (!focusLength) {
      NotificationService.show('Please select your preferred focus block length', 'error');
      return false;
    }
    return true;
  }

  validateGoals() {
    const selectedCategories = document.querySelectorAll('#step-4 .checkbox-option input[type="checkbox"]:checked');
    if (selectedCategories.length === 0) {
      NotificationService.show('Please select at least one work category', 'error');
      return false;
    }
    return true;
  }
}

/**
 * Summary Updater
 */
class SummaryUpdater {
  constructor(surveyData) {
    this.surveyData = surveyData;
  }

  updateDisplay() {
    this.updateWorkingHours();
    this.updateWorkDays();
    this.updateEnergyPeaks();
    this.updateFocusLength();
    this.updateFocusGoal();
  }

  updateWorkingHours() {
    const element = document.getElementById('summaryWorkingHours');
    if (element && this.surveyData.workingHours) {
      const { start, end } = this.surveyData.workingHours;
      element.textContent = `${this.formatTime(start)} - ${this.formatTime(end)}`;
    }
  }

  updateWorkDays() {
    const element = document.getElementById('summaryWorkDays');
    if (element && this.surveyData.workDays) {
      const dayAbbreviations = this.surveyData.workDays
        .map(day => day.charAt(0).toUpperCase() + day.slice(1, 3));
      element.textContent = dayAbbreviations.join(', ');
    }
  }

  updateEnergyPeaks() {
    const element = document.getElementById('summaryEnergyPeaks');
    if (element && this.surveyData.energyPeaks) {
      const formattedPeaks = this.surveyData.energyPeaks
        .map(peak => peak.charAt(0).toUpperCase() + peak.slice(1).replace('-', ' '));
      element.textContent = formattedPeaks.join(', ');
    }
  }

  updateFocusLength() {
    const element = document.getElementById('summaryFocusLength');
    if (element && this.surveyData.focusBlockLength) {
      element.textContent = `${this.surveyData.focusBlockLength} minutes`;
    }
  }

  updateFocusGoal() {
    const element = document.getElementById('summaryFocusGoal');
    if (element && this.surveyData.dailyFocusTimeGoal) {
      const hours = this.surveyData.dailyFocusTimeGoal;
      element.textContent = hours === 1 ? '1 hour' : `${hours} hours`;
    }
  }

  formatTime(time) {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  }
}

/**
 * Loading Manager
 */
class LoadingManager {
  show() {
    const content = document.querySelector('.onboarding-content');
    const actions = document.querySelector('.onboarding-actions');
    const loading = document.getElementById('loadingState');
    
    if (content) content.style.display = 'none';
    if (actions) actions.style.display = 'none';
    if (loading) loading.classList.add('show');
  }
}

// Initialize onboarding when dashboard loads
const initOnboarding = () => {
  if (window.location.pathname.includes('dashboard.html')) {
    setTimeout(() => {
      new OnboardingSurvey();
    }, 2000);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOnboarding);
} else {
  initOnboarding();
}

export { OnboardingSurvey, OnboardingModal, OnboardingStepCreator, OnboardingValidators, SummaryUpdater, LoadingManager };