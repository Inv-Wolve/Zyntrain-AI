/**
 * AI Service
 * Handles AI-related functionality and responses
 */

export class AIService {
  static async suggestTaskReorder(tasks, currentTime, userEnergy) {
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const priorityWeights = { urgent: 4, high: 3, medium: 2, low: 1 };
    
    const calculateScore = (task) => {
      const priorityScore = priorityWeights[task.priority] || 2;
      const energyScore = this.getEnergyMatchScore(task, userEnergy);
      const deadlineScore = this.getDeadlineUrgencyScore(task, currentTime);
      
      return priorityScore * energyScore * deadlineScore;
    };

    return [...tasks].sort((a, b) => calculateScore(b) - calculateScore(a));
  }

  static getEnergyMatchScore(task, userEnergy) {
    const energyMap = {
      high: { high: 2, medium: 1, low: 0.5 },
      medium: { high: 1.5, medium: 2, low: 1 },
      low: { high: 0.5, medium: 1, low: 2 }
    };
    
    return energyMap[userEnergy]?.[task.energyRequired] || 1;
  }

  static getDeadlineUrgencyScore(task, currentTime) {
    if (!task.deadline) return 1;
    
    const deadline = new Date(task.deadline);
    const hoursDiff = (deadline - currentTime) / (1000 * 60 * 60);
    
    if (hoursDiff < 2) return 3;
    if (hoursDiff < 24) return 2;
    return 1;
  }

  static async generateResponse(message, context = {}) {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const { tasks = [], preferences = {}, currentTime = new Date(), energyLevel = 'medium' } = context;
    const lowerMessage = message.toLowerCase();
    const activeTasks = tasks.filter(task => !task.completed);
    const completedTasks = tasks.filter(task => task.completed);

    // Response pattern matching
    const responsePatterns = [
      { keywords: ['focus', 'concentrate'], handler: () => this.getFocusResponse(activeTasks, energyLevel) },
      { keywords: ['productivity', 'productive'], handler: () => this.getProductivityResponse(completedTasks, preferences) },
      { keywords: ['schedule', 'calendar'], handler: () => this.getScheduleResponse(activeTasks, currentTime) },
      { keywords: ['task', 'tasks'], handler: () => this.getTasksResponse(activeTasks, completedTasks) }
    ];

    for (const pattern of responsePatterns) {
      if (pattern.keywords.some(keyword => lowerMessage.includes(keyword))) {
        return pattern.handler();
      }
    }

    return this.getDefaultResponse(activeTasks, completedTasks);
  }

  static getFocusResponse(activeTasks, energyLevel) {
    if (activeTasks.length === 0) {
      return "You don't have any active tasks right now! Consider adding some tasks to your list.";
    }

    const highPriorityTasks = activeTasks.filter(task => 
      ['high', 'urgent'].includes(task.priority)
    );

    if (highPriorityTasks.length > 0) {
      const nextTask = highPriorityTasks[0];
      return `Based on your current ${energyLevel} energy level, I recommend focusing on "${nextTask.title}" - it's marked as ${nextTask.priority} priority.`;
    }

    const nextTask = activeTasks[0];
    return `I suggest working on "${nextTask.title}" next. Your ${energyLevel} energy level is good for this type of task.`;
  }

  static getProductivityResponse(completedTasks, preferences) {
    const tips = [
      `You've completed ${completedTasks.length} tasks so far - great progress!`,
      `Your peak energy times are ${preferences.energyPeaks?.join(', ') || 'not set yet'}.`,
      `Take ${preferences.preferredBreakDuration || 15}-minute breaks every ${preferences.focusBlockLength || 60} minutes.`,
      'Batch similar tasks together to reduce context switching.'
    ];
    return tips.join(' ');
  }

  static getScheduleResponse(activeTasks, currentTime) {
    if (activeTasks.length === 0) {
      return "Your schedule is clear! Add some tasks and I'll help you organize them optimally.";
    }

    const urgentTasks = activeTasks.filter(task => {
      if (!task.deadline) return false;
      const deadline = new Date(task.deadline);
      const hoursUntil = (deadline - currentTime) / (1000 * 60 * 60);
      return hoursUntil <= 24 && hoursUntil > 0;
    });

    if (urgentTasks.length > 0) {
      return `You have ${urgentTasks.length} task${urgentTasks.length > 1 ? 's' : ''} due within 24 hours. I recommend prioritizing these first.`;
    }

    return `Your schedule looks manageable! You have ${activeTasks.length} active tasks.`;
  }

  static getTasksResponse(activeTasks, completedTasks) {
    if (activeTasks.length === 0 && completedTasks.length === 0) {
      return "You haven't added any tasks yet! Start by creating your first task.";
    }

    return `You currently have ${activeTasks.length} active tasks and have completed ${completedTasks.length} tasks.`;
  }

  static getDefaultResponse(activeTasks, completedTasks) {
    if (activeTasks.length === 0 && completedTasks.length === 0) {
      return "Welcome to Zyntrain AI! I'm here to help optimize your productivity. Start by adding some tasks.";
    }

    return `I'm here to help optimize your schedule! You currently have ${activeTasks.length} active tasks. What would you like to improve?`;
  }
}

// Global export for backward compatibility
window.AIService = AIService;