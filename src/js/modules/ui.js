// UI Utilities Module
export class UIManager {
  constructor() {
    this.modals = new Map();
    this.notifications = [];
  }

  // Show loading state
  showLoading(element, text = 'Loading...') {
    if (typeof element === 'string') {
      element = document.getElementById(element);
    }
    
    if (element) {
      element.innerHTML = `
        <div class="flex items-center justify-center p-8">
          <div class="spinner mr-3"></div>
          <span>${text}</span>
        </div>
      `;
    }
  }

  // Hide loading state
  hideLoading(element, content = '') {
    if (typeof element === 'string') {
      element = document.getElementById(element);
    }
    
    if (element) {
      element.innerHTML = content;
    }
  }

  // Show notification
  showNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} fixed top-4 right-4 z-50 max-w-sm`;
    notification.innerHTML = `
      <div class="flex items-center">
        <i class="fas fa-${this.getNotificationIcon(type)} mr-2"></i>
        <span>${message}</span>
        <button class="ml-auto text-lg" onclick="this.parentElement.parentElement.remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, duration);
    }

    return notification;
  }

  // Get notification icon based on type
  getNotificationIcon(type) {
    const icons = {
      success: 'check-circle',
      error: 'exclamation-circle',
      warning: 'exclamation-triangle',
      info: 'info-circle'
    };
    return icons[type] || 'info-circle';
  }

  // Show modal
  showModal(id, content, options = {}) {
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-xl p-6 max-w-md w-full mx-4 ${options.className || ''}">
        ${options.showClose !== false ? `
          <button class="absolute top-4 right-4 text-gray-500 hover:text-gray-700" onclick="UIManager.hideModal('${id}')">
            <i class="fas fa-times"></i>
          </button>
        ` : ''}
        ${content}
      </div>
    `;

    document.body.appendChild(modal);
    this.modals.set(id, modal);

    // Close on backdrop click
    if (options.closeOnBackdrop !== false) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.hideModal(id);
        }
      });
    }

    return modal;
  }

  // Hide modal
  hideModal(id) {
    const modal = this.modals.get(id);
    if (modal) {
      modal.remove();
      this.modals.delete(id);
    }
  }

  // Update element content with animation
  updateContent(element, content, animation = 'fade') {
    if (typeof element === 'string') {
      element = document.getElementById(element);
    }

    if (!element) return;

    if (animation === 'fade') {
      element.style.opacity = '0';
      setTimeout(() => {
        element.innerHTML = content;
        element.style.opacity = '1';
      }, 150);
    } else {
      element.innerHTML = content;
    }
  }

  // Format date for display
  formatDate(date, format = 'short') {
    const options = {
      short: { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      },
      long: { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    };

    return new Intl.DateTimeFormat('en-US', options[format]).format(new Date(date));
  }

  // Validate form
  validateForm(formElement) {
    const errors = [];
    const inputs = formElement.querySelectorAll('input[required], select[required], textarea[required]');

    inputs.forEach(input => {
      if (!input.value.trim()) {
        errors.push(`${input.name || input.id} is required`);
        input.classList.add('border-error-500');
      } else {
        input.classList.remove('border-error-500');
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Debounce function
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle function
  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
}

// Create global instance
window.UIManager = new UIManager();
