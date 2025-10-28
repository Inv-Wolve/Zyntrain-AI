/**
 * Confirmation Dialog Component
 * Reusable confirmation dialog for user actions
 */

export class ConfirmationDialog {
  static show(title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning') {
    return new Promise((resolve) => {
      const modal = this.createModal(title, message, confirmText, cancelText, type);
      document.body.appendChild(modal);
      
      // Show modal with animation
      requestAnimationFrame(() => {
        modal.classList.add('show');
      });
      
      const cleanup = (result) => {
        modal.classList.remove('show');
        setTimeout(() => {
          if (modal.parentNode) {
            modal.remove();
          }
        }, 300);
        resolve(result);
      };
      
      // Event listeners
      modal.querySelector('.confirm-btn').addEventListener('click', () => cleanup(true));
      modal.querySelector('.cancel-btn').addEventListener('click', () => cleanup(false));
      
      // Close on escape key
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          cleanup(false);
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
      
      // Close on backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) cleanup(false);
      });
    });
  }

  static createModal(title, message, confirmText, cancelText, type) {
    const modal = document.createElement('div');
    modal.className = 'confirmation-modal';
    
    const iconClass = type === 'danger' ? 'exclamation-triangle' : 'question-circle';
    const btnClass = type === 'danger' ? 'btn-danger' : 'btn-primary';
    
    modal.innerHTML = `
      <div class="confirmation-content">
        <div class="confirmation-header">
          <div class="confirmation-icon">
            <i class="fas fa-${iconClass}"></i>
          </div>
          <h3>${title}</h3>
          <p>${message}</p>
        </div>
        <div class="confirmation-actions">
          <button class="btn btn-secondary cancel-btn">${cancelText}</button>
          <button class="btn ${btnClass} confirm-btn">${confirmText}</button>
        </div>
      </div>
    `;
    
    return modal;
  }
}

// Global export for backward compatibility
window.ConfirmationDialog = ConfirmationDialog;