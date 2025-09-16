// Login Component
import { AuthManager } from '../modules/auth.js';
import { UIManager } from '../modules/ui.js';

class LoginComponent {
  constructor() {
    this.authManager = new AuthManager();
    this.uiManager = new UIManager();
    this.init();
  }

  init() {
    // Check if already authenticated
    if (this.authManager.isAuthenticated()) {
      this.authManager.redirectToRolePage();
      return;
    }

    this.setupEventListeners();
  }

  setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Input field animations
    document.querySelectorAll('.input-field').forEach(input => {
      input.addEventListener('focus', () => {
        input.parentElement.classList.add('focused');
      });

      input.addEventListener('blur', () => {
        if (!input.value) {
          input.parentElement.classList.remove('focused');
        }
      });
    });
  }

  async handleLogin(event) {
    event.preventDefault();

    const voterId = document.getElementById('voter-id').value.trim();
    const password = document.getElementById('password').value.trim();
    const loginBtn = document.getElementById('loginBtn');

    // Validate inputs
    if (!voterId || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    // Show loading state
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;
    this.hideMessages();

    try {
      const result = await this.authManager.login(voterId, password);
      
      if (result.success) {
        this.showSuccess('Login successful! Redirecting...');
        
        setTimeout(() => {
          this.authManager.redirectToRolePage();
        }, 1500);
      }
    } catch (error) {
      this.showError('Invalid credentials. Please check your Voter ID and password.');
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
    }
  }

  showError(message) {
    const errorElement = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    
    if (errorElement && errorText) {
      errorText.textContent = message;
      errorElement.style.display = 'block';
      setTimeout(() => errorElement.style.display = 'none', 5000);
    }
  }

  showSuccess(message) {
    const successElement = document.getElementById('successMessage');
    const successText = document.getElementById('successText');
    
    if (successElement && successText) {
      successText.textContent = message;
      successElement.style.display = 'block';
    }
  }

  hideMessages() {
    const errorElement = document.getElementById('errorMessage');
    const successElement = document.getElementById('successMessage');
    
    if (errorElement) errorElement.style.display = 'none';
    if (successElement) successElement.style.display = 'none';
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new LoginComponent();
});
