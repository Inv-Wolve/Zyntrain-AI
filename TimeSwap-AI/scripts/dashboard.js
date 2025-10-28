/**
 * Dashboard Page Handler
 * Manages task management, AI chat, calendar, and analytics
 */

import { Utils } from './utils.js';
import { NotificationService } from './services/notification.js';
import { ApiService } from './services/api.js';
import { AIService } from './services/ai.js';
import { ConfirmationDialog } from './components/confirmation-dialog.js';

class Dashboard {
  constructor() {
    this.state = {
      currentSection: 'overview',
      tasks: [],
      aiChats: [],
      analytics: {},
      schedule: {},
      currentFilter: 'all',
      currentWeek: new Date()
    };
    
    this.taskManager = new TaskManager();
    this.aiChatManager = new AIChatManager();
    this.calendarManager = new CalendarManager();
    this.analyticsManager = new AnalyticsManager();
    this.eventListeners = [];
    
    this.init();
  }

  async init() {
    this.initNavigation();
    this.initEventListeners();
    await this.loadData();
    this.updateUI();
    this.startRealTimeUpdates();
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

    this.updatePageTitle(sectionId);
    this.state.currentSection = sectionId;
    this.loadSectionData(sectionId);
  }

  updatePageTitle(sectionId) {
    const titles = {
      overview: {
        title: 'Dashboard Overview',
        subtitle: 'Welcome back! Here\'s what\'s happening today.'
      },
      tasks: {
        title: 'Task Management',
        subtitle: 'Organize and prioritize your tasks with AI assistance.'
      },
      calendar: {
        title: 'Calendar View',
        subtitle: 'View and manage your schedule across all connected calendars.'
      },
      'ai-assistant': {
        title: 'AI Assistant',
        subtitle: 'Get personalized productivity advice and schedule optimization.'
      },
      analytics: {
        title: 'Analytics & Insights',
        subtitle: 'Track your productivity trends and performance metrics.'
      }
    };

    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');

    if (pageTitle && titles[sectionId]) {
      pageTitle.textContent = titles[sectionId].title;
    }
    if (pageSubtitle && titles[sectionId]) {
      pageSubtitle.textContent = titles[sectionId].subtitle;
    }
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
      'add-task': () => this.taskManager.showModal(),
      'edit-task': () => this.taskManager.editTask(element.dataset.taskId),
      'delete-task': () => this.taskManager.deleteTask(element.dataset.taskId),
      'complete-task': () => this.taskManager.toggleComplete(element.dataset.taskId),
      'ai-optimize': () => this.optimizeWithAI(),
      'send-ai-message': () => this.aiChatManager.sendMessage(),
      'clear-chat': () => this.aiChatManager.clearChat(),
      'sync-calendar': () => this.calendarManager.sync(),
      'connect-google-calendar': () => this.calendarManager.connect(),
      'prev-week': () => this.calendarManager.navigateWeek(-1),
      'next-week': () => this.calendarManager.navigateWeek(1),
      'today': () => this.calendarManager.goToToday(),
      'close-modal': () => this.closeModal(),
      'send-suggestion': () => this.aiChatManager.sendSuggestion(element.dataset.question)
    };

    const handler = actions[action];
    if (handler) {
      handler();
    }
  }

  async loadData() {
    try {
      const [tasksResponse, chatsResponse, analyticsResponse, scheduleResponse] = await Promise.all([
        ApiService.getTasks().catch(() => ({ tasks: [] })),
        ApiService.getAIChats().catch(() => ({ chats: [] })),
        ApiService.getAnalytics().catch(() => ({})),
        ApiService.getSchedule().catch(() => ({ events: [] }))
      ]);

      this.state.tasks = tasksResponse.tasks || [];
      this.state.aiChats = chatsResponse.chats || [];
      this.state.analytics = analyticsResponse;
      this.state.schedule = scheduleResponse;

      // Update managers with new data
      this.taskManager.updateTasks(this.state.tasks);
      this.aiChatManager.updateChats(this.state.aiChats);
      this.calendarManager.updateSchedule(this.state.schedule);
      this.analyticsManager.updateAnalytics(this.state.analytics);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      NotificationService.show('Error loading dashboard data. Please refresh the page.', 'error');
    }
  }

  async loadSectionData(sectionId) {
    const loaders = {
      calendar: () => this.calendarManager.loadData(),
      analytics: () => this.analyticsManager.loadData()
    };

    const loader = loaders[sectionId];
    if (loader) {
      await loader();
    }
  }

  updateUI() {
    this.updateOverviewStats();
    this.taskManager.render();
    this.aiChatManager.render();
    this.calendarManager.render();
    this.updateAIRecommendations();
    this.updateTodaySchedule();
    this.updateEnergyLevel();
  }

  updateOverviewStats() {
    const activeTasks = this.state.tasks.filter(task => !task.completed);
    const completedToday = this.state.tasks.filter(task => 
      task.completed && this.isToday(new Date(task.completedAt))
    );

    this.updateStatElement('totalTasks', activeTasks.length);
    this.updateStatElement('completedTasks', completedToday.length);
    this.updateStatElement('focusTime', this.state.analytics.focusTime || 0);
    this.updateStatElement('aiSuggestions', this.state.aiChats.length);

    // Update trends
    const trends = this.state.analytics.trends || {};
    this.updateTrendElement('totalTasksTrend', trends.totalTasks || 0);
    this.updateTrendElement('completedTasksTrend', trends.completed || 0);
    this.updateTrendElement('focusTimeTrend', trends.focus || 0);
    this.updateTrendElement('aiSuggestionsTrend', trends.aiUsage || 0);
  }

  updateStatElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = elementId === 'focusTime' ? `${value}h` : value;
    }
  }

  updateTrendElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      const isPositive = value >= 0;
      element.textContent = isPositive ? `+${value}%` : `${value}%`;
      element.parentElement.className = `stat-trend ${isPositive ? 'positive' : 'negative'}`;
    }
  }

  updateAIRecommendations() {
    const recommendationsEl = document.getElementById('aiRecommendations');
    if (!recommendationsEl) return;

    if (this.state.tasks.length === 0) {
      recommendationsEl.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-brain"></i>
          <h4>AI Learning Your Patterns</h4>
          <p>Add some tasks and I'll provide personalized recommendations.</p>
        </div>
      `;
      return;
    }

    const recommendations = this.generateAIRecommendations();
    recommendationsEl.innerHTML = recommendations.map(rec => `
      <div class="recommendation-item">
        <i class="fas fa-${rec.icon}"></i>
        <div class="recommendation-text">${rec.text}</div>
      </div>
    `).join('');
  }

  generateAIRecommendations() {
    const activeTasks = this.state.tasks.filter(task => !task.completed);
    const recommendations = [];

    if (activeTasks.length === 0) {
      return [{
        icon: 'check-circle',
        text: 'Great job! All tasks completed. Consider adding new goals for tomorrow.'
      }];
    }

    // High priority tasks
    const highPriorityTasks = activeTasks.filter(task => 
      ['high', 'urgent'].includes(task.priority)
    );
    
    if (highPriorityTasks.length > 0) {
      recommendations.push({
        icon: 'exclamation-triangle',
        text: `Focus on "${highPriorityTasks[0].title}" - it's marked as ${highPriorityTasks[0].priority} priority.`
      });
    }

    // Overdue tasks
    const overdueTasks = activeTasks.filter(task => {
      if (!task.deadline) return false;
      return new Date(task.deadline) < new Date();
    });

    if (overdueTasks.length > 0) {
      recommendations.push({
        icon: 'clock',
        text: `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}. Consider rescheduling or breaking them into smaller parts.`
      });
    }

    // Energy-based recommendations
    const currentHour = new Date().getHours();
    if (currentHour >= 9 && currentHour <= 11) {
      const highEnergyTasks = activeTasks.filter(task => task.energyRequired === 'high');
      if (highEnergyTasks.length > 0) {
        recommendations.push({
          icon: 'bolt',
          text: 'Morning energy is high! Perfect time for demanding tasks like coding or creative work.'
        });
      }
    }

    if (recommendations.length === 0) {
      recommendations.push({
        icon: 'lightbulb',
        text: 'Your schedule looks balanced. Consider time-blocking your tasks for better focus.'
      });
    }

    return recommendations.slice(0, 3);
  }

  updateTodaySchedule() {
    const scheduleEl = document.getElementById('todaySchedule');
    if (!scheduleEl) return;

    const todayTasks = this.state.tasks.filter(task => {
      if (!task.deadline) return false;
      return this.isToday(new Date(task.deadline));
    });

    if (todayTasks.length === 0) {
      scheduleEl.innerHTML = `
        <div class="empty-schedule">
          <i class="fas fa-calendar-plus"></i>
          <h4>No tasks scheduled</h4>
          <p>Add tasks with deadlines to see your optimized schedule.</p>
        </div>
      `;
      return;
    }

    scheduleEl.innerHTML = todayTasks.map(task => `
      <div class="schedule-item">
        <div class="schedule-time">${Utils.formatTime(task.deadline)}</div>
        <div class="schedule-task">${Utils.escapeHtml(task.title)}</div>
      </div>
    `).join('');
  }

  updateEnergyLevel() {
    const energyLevelEl = document.getElementById('energyLevel');
    const energyFillEl = document.getElementById('energyFill');

    const { energy, percentage } = this.calculateEnergyLevel();

    if (energyLevelEl) energyLevelEl.textContent = energy;
    if (energyFillEl) energyFillEl.style.width = `${percentage}%`;
  }

  calculateEnergyLevel() {
    const hour = new Date().getHours();
    
    if (hour >= 9 && hour <= 11) return { energy: 'High', percentage: 85 };
    if (hour >= 14 && hour <= 16) return { energy: 'Medium', percentage: 65 };
    if (hour >= 20 || hour <= 6) return { energy: 'Low', percentage: 30 };
    
    return { energy: 'Medium', percentage: 50 };
  }

  async optimizeWithAI() {
    if (this.state.tasks.length === 0) {
      NotificationService.show('Add some tasks first to get AI optimization suggestions.', 'info');
      return;
    }

    NotificationService.show('AI is analyzing your tasks...', 'info');

    try {
      const activeTasks = this.state.tasks.filter(task => !task.completed);
      const currentTime = new Date();
      const userEnergy = this.calculateEnergyLevel().energy.toLowerCase();

      const optimizedTasks = await AIService.suggestTaskReorder(activeTasks, currentTime, userEnergy);

      this.state.tasks = [
        ...optimizedTasks,
        ...this.state.tasks.filter(task => task.completed)
      ];

      this.taskManager.updateTasks(this.state.tasks);
      this.taskManager.render();
      
      NotificationService.show('Tasks optimized based on your energy level and deadlines!', 'success');
    } catch (error) {
      console.error('Error optimizing tasks:', error);
      NotificationService.show('Error optimizing tasks. Please try again.', 'error');
    }
  }

  closeModal() {
    const modal = document.getElementById('taskModal');
    if (modal) {
      modal.classList.remove('show');
    }
  }

  isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  startRealTimeUpdates() {
    // Update energy level every 30 minutes
    setInterval(() => this.updateEnergyLevel(), 30 * 60 * 1000);
    
    // Update time displays every minute
    setInterval(() => this.updateTimeDisplays(), 60 * 1000);
  }

  updateTimeDisplays() {
    document.querySelectorAll('.message-time').forEach(timeEl => {
      const timestamp = timeEl.dataset.timestamp;
      if (timestamp) {
        timeEl.textContent = Utils.getTimeAgo(timestamp);
      }
    });
  }

  destroy() {
    // Clean up event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    // Clean up managers
    if (this.taskManager) this.taskManager.destroy();
    if (this.aiChatManager) this.aiChatManager.destroy();
    if (this.calendarManager) this.calendarManager.destroy();
    if (this.analyticsManager) this.analyticsManager.destroy();
  }
}

/**
 * Task Manager - Handles all task-related functionality
 */
class TaskManager {
  constructor() {
    this.tasks = [];
    this.currentFilter = 'all';
    this.eventListeners = [];
    this.initEventListeners();
  }

  initEventListeners() {
    // Task form submission
    const taskForm = document.getElementById('taskForm');
    if (taskForm) {
      const handler = (e) => {
        e.preventDefault();
        this.handleSubmit(new FormData(e.target));
      };

      taskForm.addEventListener('submit', handler);
      this.eventListeners.push({ element: taskForm, event: 'submit', handler });
    }

    // Filter tabs
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
      const handler = () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentFilter = tab.dataset.filter;
        this.render();
      };

      tab.addEventListener('click', handler);
      this.eventListeners.push({ element: tab, event: 'click', handler });
    });
  }

  updateTasks(tasks) {
    this.tasks = tasks;
  }

  render() {
    const tasksList = document.getElementById('tasksList');
    if (!tasksList) return;

    const filteredTasks = this.getFilteredTasks();

    if (filteredTasks.length === 0) {
      tasksList.innerHTML = this.getEmptyStateHTML();
      return;
    }

    tasksList.innerHTML = filteredTasks.map(task => this.createTaskHTML(task)).join('');
    this.updateTaskCounts();
  }

  getFilteredTasks() {
    let filtered = [...this.tasks];

    const filters = {
      today: (tasks) => tasks.filter(task => {
        if (!task.deadline) return false;
        return this.isToday(new Date(task.deadline));
      }),
      high: (tasks) => tasks.filter(task => 
        ['high', 'urgent'].includes(task.priority)
      ),
      completed: (tasks) => tasks.filter(task => task.completed)
    };

    const filter = filters[this.currentFilter];
    if (filter) {
      filtered = filter(filtered);
    }

    return this.sortTasks(filtered);
  }

  sortTasks(tasks) {
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
    
    return tasks.sort((a, b) => {
      // Completed tasks go to bottom
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }

      // Sort by priority
      const aPriority = priorityOrder[a.priority] || 2;
      const bPriority = priorityOrder[b.priority] || 2;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // Sort by deadline
      if (a.deadline && b.deadline) {
        return new Date(a.deadline) - new Date(b.deadline);
      }

      return 0;
    });
  }

  createTaskHTML(task) {
    const priorityClass = task.priority || 'medium';
    const isCompleted = task.completed;
    const deadline = task.deadline ? new Date(task.deadline) : null;
    const isOverdue = deadline && deadline < new Date() && !isCompleted;

    return `
      <div class="task-item ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}" data-task-id="${task.id}">
        <div class="task-checkbox ${isCompleted ? 'checked' : ''}" data-action="complete-task" data-task-id="${task.id}">
          ${isCompleted ? '<i class="fas fa-check"></i>' : ''}
        </div>
        <div class="task-content">
          <div class="task-title">${Utils.escapeHtml(task.title)}</div>
          <div class="task-meta">
            <span class="task-priority ${priorityClass}">${priorityClass}</span>
            ${task.category ? `<span class="task-category">${task.category}</span>` : ''}
            ${deadline ? `<span class="task-deadline">${Utils.formatDateTime(deadline)}</span>` : ''}
            ${task.duration ? `<span class="task-duration">${task.duration}min</span>` : ''}
          </div>
        </div>
        <div class="task-actions">
          <button class="task-action-btn" data-action="edit-task" data-task-id="${task.id}" title="Edit Task">
            <i class="fas fa-edit"></i>
          </button>
          <button class="task-action-btn danger" data-action="delete-task" data-task-id="${task.id}" title="Delete Task">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }

  getEmptyStateHTML() {
    return `
      <div class="empty-state">
        <i class="fas fa-tasks"></i>
        <h4>No tasks yet</h4>
        <p>Add your first task to get started with AI-powered productivity.</p>
        <button class="btn btn-primary" data-action="add-task">
          <i class="fas fa-plus"></i>
          Add Your First Task
        </button>
      </div>
    `;
  }

  updateTaskCounts() {
    const activeCount = this.tasks.filter(task => !task.completed).length;
    const completedCount = this.tasks.filter(task => task.completed).length;

    const activeCountEl = document.getElementById('activeTaskCount');
    const completedCountEl = document.getElementById('completedTaskCount');

    if (activeCountEl) activeCountEl.textContent = `${activeCount} active`;
    if (completedCountEl) completedCountEl.textContent = `${completedCount} completed`;
  }

  showModal(taskId = null) {
    const modal = document.getElementById('taskModal');
    if (!modal) return;

    const modalTitle = document.getElementById('modalTitle');
    const taskForm = document.getElementById('taskForm');

    if (taskId) {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;

      if (modalTitle) modalTitle.textContent = 'Edit Task';
      this.populateForm(task);
    } else {
      if (modalTitle) modalTitle.textContent = 'Add New Task';
      if (taskForm) taskForm.reset();
    }

    modal.classList.add('show');
  }

  populateForm(task) {
    const fields = [
      { id: 'taskTitle', value: task.title },
      { id: 'taskDescription', value: task.description },
      { id: 'taskPriority', value: task.priority },
      { id: 'taskCategory', value: task.category },
      { id: 'taskDuration', value: task.duration },
      { id: 'taskEnergy', value: task.energyRequired }
    ];

    fields.forEach(field => {
      const element = document.getElementById(field.id);
      if (element && field.value) {
        element.value = field.value;
      }
    });

    if (task.deadline) {
      const deadlineEl = document.getElementById('taskDeadline');
      if (deadlineEl) {
        const deadline = new Date(task.deadline);
        deadlineEl.value = deadline.toISOString().slice(0, 16);
      }
    }
  }

  async handleSubmit(formData) {
    const taskData = {
      title: formData.get('title'),
      description: formData.get('description'),
      priority: formData.get('priority'),
      category: formData.get('category'),
      deadline: formData.get('deadline'),
      duration: parseInt(formData.get('duration')),
      energyRequired: formData.get('energy')
    };

    if (!taskData.title) {
      NotificationService.show('Task title is required', 'error');
      return;
    }

    try {
      const response = await ApiService.addTask(taskData);
      if (response.success) {
        this.tasks.push(response.task);
        this.render();
        this.closeModal();
        NotificationService.show('Task added successfully!', 'success');

        // Try to sync to calendar if connected
        if (taskData.deadline) {
          this.syncTaskToCalendar(response.task);
        }
      } else {
        NotificationService.show(response.message || 'Error adding task', 'error');
      }
    } catch (error) {
      console.error('Error adding task:', error);
      NotificationService.show('Error adding task. Please try again.', 'error');
    }
  }

  async editTask(taskId) {
    this.showModal(taskId);
  }

  async deleteTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    const confirmed = await ConfirmationDialog.show(
      'Delete Task',
      `Are you sure you want to delete "${task.title}"? This action cannot be undone.`,
      'Delete',
      'Cancel',
      'danger'
    );

    if (confirmed) {
      try {
        const response = await ApiService.deleteTask(taskId);
        if (response.success) {
          this.tasks = this.tasks.filter(t => t.id !== taskId);
          this.render();
          NotificationService.show('Task deleted successfully!', 'success');
        } else {
          NotificationService.show(response.message || 'Error deleting task', 'error');
        }
      } catch (error) {
        console.error('Error deleting task:', error);
        NotificationService.show('Error deleting task. Please try again.', 'error');
      }
    }
  }

  async toggleComplete(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    const updates = {
      completed: !task.completed,
      completedAt: !task.completed ? new Date().toISOString() : null
    };

    try {
      const response = await ApiService.updateTask(taskId, updates);
      if (response.success) {
        Object.assign(task, updates);
        this.render();
        NotificationService.show(
          task.completed ? 'Task completed! 🎉' : 'Task marked as incomplete',
          'success'
        );
      } else {
        NotificationService.show(response.message || 'Error updating task', 'error');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      NotificationService.show('Error updating task. Please try again.', 'error');
    }
  }

  closeModal() {
    const modal = document.getElementById('taskModal');
    if (modal) {
      modal.classList.remove('show');
    }
  }

  async syncTaskToCalendar(task) {
    if (!task.deadline) return;

    try {
      const eventData = {
        summary: task.title,
        description: task.description || '',
        start: task.deadline,
        duration: task.duration || 30
      };

      await ApiService.createCalendarEvent(eventData);
    } catch (error) {
      console.warn('Could not sync task to calendar:', error);
    }
  }

  isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
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
 * AI Chat Manager - Handles AI assistant functionality
 */
class AIChatManager {
  constructor() {
    this.chats = [];
    this.eventListeners = [];
    this.initEventListeners();
  }

  initEventListeners() {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
      const handler = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      };

      chatInput.addEventListener('keypress', handler);
      this.eventListeners.push({ element: chatInput, event: 'keypress', handler });
    }
  }

  updateChats(chats) {
    this.chats = chats;
  }

  render() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    if (this.chats.length === 0) {
      chatMessages.innerHTML = this.getWelcomeMessage();
      return;
    }

    const messagesHTML = this.chats.map(chat => this.createChatHTML(chat)).join('');
    chatMessages.innerHTML = messagesHTML;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  getWelcomeMessage() {
    return `
      <div class="message ai-message">
        <div class="message-avatar">
          <i class="fas fa-robot"></i>
        </div>
        <div class="message-content">
          <p>Hello! I'm your Zyntrain AI assistant. I can help you optimize your schedule, suggest task priorities, and provide productivity insights. What would you like to know?</p>
          <div class="message-time">Just now</div>
        </div>
      </div>
    `;
  }

  createChatHTML(chat) {
    return `
      <div class="message user-message">
        <div class="message-avatar">
          <i class="fas fa-user"></i>
        </div>
        <div class="message-content">
          <p>${Utils.escapeHtml(chat.message)}</p>
          <div class="message-time">${Utils.getTimeAgo(chat.timestamp)}</div>
        </div>
      </div>
      <div class="message ai-message">
        <div class="message-avatar">
          <i class="fas fa-robot"></i>
        </div>
        <div class="message-content">
          <p>${Utils.escapeHtml(chat.response)}</p>
          <div class="message-time">${Utils.getTimeAgo(chat.timestamp)}</div>
        </div>
      </div>
    `;
  }

  async sendMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || !chatInput.value.trim()) return;

    const message = chatInput.value.trim();
    chatInput.value = '';

    // Check daily limit
    if (this.isDailyLimitReached()) {
      NotificationService.show(
        'Daily AI chat limit reached (10 messages). Limit resets tomorrow.',
        'warning'
      );
      return;
    }

    try {
      const context = this.buildContext();
      const aiResponse = await AIService.generateResponse(message, context);

      const chatData = {
        message,
        response: aiResponse,
        timestamp: new Date().toISOString()
      };

      const response = await ApiService.addAIChat(chatData.message, chatData.response);
      if (response.success) {
        this.chats.push(chatData);
        this.render();
      } else {
        NotificationService.show(response.message || 'Error sending message', 'error');
      }
    } catch (error) {
      console.error('Error sending AI message:', error);
      NotificationService.show('Error sending message. Please try again.', 'error');
    }
  }

  async sendSuggestion(question) {
    if (!question) return;

    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
      chatInput.value = question;
      await this.sendMessage();
    }
  }

  buildContext() {
    return {
      tasks: window.dashboard?.state.tasks || [],
      preferences: {},
      currentTime: new Date(),
      energyLevel: this.getCurrentEnergyLevel()
    };
  }

  getCurrentEnergyLevel() {
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 11) return 'high';
    if (hour >= 14 && hour <= 16) return 'medium';
    if (hour >= 20 || hour <= 6) return 'low';
    return 'medium';
  }

  isDailyLimitReached() {
    const today = new Date().toDateString();
    const todayChats = this.chats.filter(chat => 
      new Date(chat.timestamp).toDateString() === today
    );
    return todayChats.length >= 10;
  }

  async clearChat() {
    const confirmed = await ConfirmationDialog.show(
      'Clear Chat History',
      'Are you sure you want to clear all chat history? This action cannot be undone.',
      'Clear Chat',
      'Cancel',
      'warning'
    );

    if (confirmed) {
      try {
        const response = await ApiService.clearAIChats();
        if (response.success) {
          this.chats = [];
          this.render();
          NotificationService.show('Chat history cleared!', 'success');
        } else {
          NotificationService.show(response.message || 'Error clearing chat', 'error');
        }
      } catch (error) {
        console.error('Error clearing chat:', error);
        NotificationService.show('Error clearing chat. Please try again.', 'error');
      }
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
 * Calendar Manager - Handles calendar functionality
 */
class CalendarManager {
  constructor() {
    this.schedule = { events: [] };
    this.currentWeek = new Date();
  }

  updateSchedule(schedule) {
    this.schedule = schedule;
  }

  async loadData() {
    try {
      const calendarData = await ApiService.getCalendarEvents();
      if (calendarData.success) {
        this.schedule.events = calendarData.events || [];
        this.render();
      }
    } catch (error) {
      console.error('Error loading calendar data:', error);
    }
  }

  render() {
    this.updateCalendarView();
  }

  updateCalendarView() {
    const calendarGrid = document.getElementById('calendarGrid');
    if (!calendarGrid) return;

    // Update current week display
    const currentWeekEl = document.getElementById('currentWeek');
    if (currentWeekEl) {
      const weekStart = this.getWeekStart(this.currentWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      currentWeekEl.textContent = `${Utils.formatDate(weekStart)} - ${Utils.formatDate(weekEnd)}`;
    }

    calendarGrid.innerHTML = this.generateCalendarHTML();
  }

  generateCalendarHTML() {
    const weekStart = this.getWeekStart(this.currentWeek);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let html = '<div class="calendar-week-header">';
    days.forEach(day => {
      html += `<div class="week-day">${day}</div>`;
    });
    html += '</div>';

    html += '<div class="calendar-week">';
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);

      const isToday = this.isToday(date);
      const dayEvents = this.getEventsForDate(date);

      html += `
        <div class="calendar-day ${isToday ? 'today' : ''}">
          <div class="day-number">${date.getDate()}</div>
          <div class="day-events">
            ${dayEvents.map(event => `
              <div class="calendar-event">${Utils.escapeHtml(event.title)}</div>
            `).join('')}
          </div>
        </div>
      `;
    }
    html += '</div>';

    return html;
  }

  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  getEventsForDate(date) {
    const dateStr = date.toISOString().split('T')[0];

    // Get tasks for this date
    const tasks = window.dashboard?.state.tasks || [];
    const tasksForDate = tasks.filter(task => {
      if (!task.deadline) return false;
      const taskDate = new Date(task.deadline).toISOString().split('T')[0];
      return taskDate === dateStr;
    });

    // Get calendar events for this date
    const calendarEvents = this.schedule.events?.filter(event => {
      if (!event.start) return false;
      const eventDate = new Date(event.start).toISOString().split('T')[0];
      return eventDate === dateStr;
    }) || [];

    return [
      ...tasksForDate.map(task => ({ title: task.title, type: 'task' })),
      ...calendarEvents.map(event => ({ 
        title: event.summary || event.title, 
        type: 'event' 
      }))
    ];
  }

  navigateWeek(direction) {
    const newWeek = new Date(this.currentWeek);
    newWeek.setDate(newWeek.getDate() + direction * 7);
    this.currentWeek = newWeek;
    this.updateCalendarView();
  }

  goToToday() {
    this.currentWeek = new Date();
    this.updateCalendarView();
  }

  async sync() {
    const syncBtn = document.getElementById('syncCalendarBtn');
    const syncText = document.getElementById('syncCalendarText');

    try {
      if (syncText) syncText.textContent = 'Syncing...';
      if (syncBtn) syncBtn.disabled = true;

      const response = await ApiService.syncGoogleCalendar();
      if (response.success) {
        await this.loadData();
        NotificationService.show('Calendar synced successfully!', 'success');
      } else {
        NotificationService.show(response.message || 'Error syncing calendar', 'error');
      }
    } catch (error) {
      console.error('Error syncing calendar:', error);
      NotificationService.show('Error syncing calendar. Please try again.', 'error');
    } finally {
      if (syncText) syncText.textContent = 'Sync Google Calendar';
      if (syncBtn) syncBtn.disabled = false;
    }
  }

  async connect() {
    if (window.GoogleCalendarHelper) {
      window.GoogleCalendarHelper.showConnectionGuide();
    }
  }

  isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  destroy() {
    // No specific cleanup needed for calendar manager
  }
}

/**
 * Analytics Manager - Handles analytics and insights
 */
class AnalyticsManager {
  constructor() {
    this.analytics = {};
  }

  updateAnalytics(analytics) {
    this.analytics = analytics;
  }

  async loadData() {
    try {
      const analyticsData = await ApiService.getAnalytics();
      this.analytics = analyticsData;
      this.render();
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  }

  render() {
    this.updateTimeDistribution();
    this.updateGoalProgress();
  }

  updateTimeDistribution() {
    const timeDistribution = this.analytics.timeDistribution || {};

    const elements = [
      { id: 'deepWorkTime', key: 'work' },
      { id: 'meetingsTime', key: 'meetings' },
      { id: 'adminTime', key: 'admin' }
    ];

    elements.forEach(({ id, key }) => {
      const element = document.getElementById(id);
      if (element) {
        const data = timeDistribution[key] || { hours: 0, percentage: 0 };
        element.textContent = `${data.hours}h (${data.percentage}%)`;
      }
    });
  }

  updateGoalProgress() {
    const tasks = window.dashboard?.state.tasks || [];
    const completedTasks = tasks.filter(task => task.completed).length;
    const totalTasks = tasks.length;
    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const primaryGoalProgress = document.getElementById('primaryGoalProgress');
    const primaryGoalPercentage = document.getElementById('primaryGoalPercentage');

    if (primaryGoalProgress) {
      primaryGoalProgress.style.width = `${completionPercentage}%`;
    }
    if (primaryGoalPercentage) {
      primaryGoalPercentage.textContent = `${completionPercentage}%`;
    }

    // Update focus time progress
    const focusTimeProgress = document.getElementById('focusTimeProgress');
    const focusTimeActual = document.getElementById('focusTimeActual');
    const dailyFocusGoal = 2; // Default goal
    const actualFocusTime = this.analytics.focusTime || 0;
    const focusPercentage = Math.min(100, Math.round((actualFocusTime / dailyFocusGoal) * 100));

    if (focusTimeProgress) {
      focusTimeProgress.style.width = `${focusPercentage}%`;
    }
    if (focusTimeActual) {
      focusTimeActual.textContent = `${actualFocusTime}h`;
    }
  }

  destroy() {
    // No specific cleanup needed for analytics manager
  }
}

// Initialize dashboard
const initDashboard = () => {
  if (window.location.pathname.includes('dashboard.html')) {
    const dashboard = new Dashboard();
    window.dashboard = dashboard;
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}

// Export for use in other files
export { Dashboard, TaskManager, AIChatManager, CalendarManager, AnalyticsManager };