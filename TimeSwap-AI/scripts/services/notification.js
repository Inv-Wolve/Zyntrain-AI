/**
 * Notification Service
 * Handles all application notifications and alerts
 */

export class NotificationService {
  static notifications = new Set();

  static show(message, type = 'info', duration = 5000) {
    const notification = this.createNotification(message, type);
    document.body.appendChild(notification);
    this.notifications.add(notification);
    
    // Animate in
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });
    
    // Auto remove
    if (duration > 0) {
      setTimeout(() => this.remove(notification), duration);
    }
    
    // Manual close handler
    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.remove(notification));
    }

    return notification;
  }

  static createNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
      success: 'check-circle',
      error: 'exclamation-circle',
      warning: 'exclamation-triangle',
      info: 'info-circle'
    };

    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${icons[type] || icons.info}"></i>
        <span>${message}</span>
      </div>
      <button class="notification-close">
        <i class="fas fa-times"></i>
      </button>
    `;

    return notification;
  }

  static remove(notification) {
    if (!notification || !notification.parentNode) return;
    
    notification.classList.remove('show');
    this.notifications.delete(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }

  static clear() {
    this.notifications.forEach(notification => this.remove(notification));
  }
}

// Global export for backward compatibility
window.NotificationService = NotificationService;