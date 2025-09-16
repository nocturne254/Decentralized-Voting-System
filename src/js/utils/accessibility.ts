// Accessibility utilities for WCAG 2.1 compliance
import { logger } from './logger';

export class AccessibilityManager {
  private static instance: AccessibilityManager;
  private announcer: HTMLElement | null = null;
  private focusHistory: HTMLElement[] = [];

  private constructor() {
    this.setupScreenReaderAnnouncer();
    this.setupKeyboardNavigation();
    this.setupFocusManagement();
  }

  static getInstance(): AccessibilityManager {
    if (!AccessibilityManager.instance) {
      AccessibilityManager.instance = new AccessibilityManager();
    }
    return AccessibilityManager.instance;
  }

  private setupScreenReaderAnnouncer(): void {
    this.announcer = document.createElement('div');
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    this.announcer.className = 'sr-only';
    this.announcer.style.cssText = `
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    `;
    document.body.appendChild(this.announcer);
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (this.announcer) {
      this.announcer.setAttribute('aria-live', priority);
      this.announcer.textContent = message;
      
      // Clear after announcement
      setTimeout(() => {
        if (this.announcer) {
          this.announcer.textContent = '';
        }
      }, 1000);
    }
  }

  private setupKeyboardNavigation(): void {
    document.addEventListener('keydown', (event) => {
      // Skip links navigation (Alt + S)
      if (event.altKey && event.key === 's') {
        event.preventDefault();
        this.showSkipLinks();
      }

      // Modal escape handling
      if (event.key === 'Escape') {
        this.handleEscapeKey();
      }

      // Tab trapping in modals
      if (event.key === 'Tab') {
        this.handleTabNavigation(event);
      }

      // Arrow key navigation for custom components
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        this.handleArrowNavigation(event);
      }
    });
  }

  private setupFocusManagement(): void {
    // Track focus changes
    document.addEventListener('focusin', (event) => {
      const target = event.target as HTMLElement;
      if (target && target !== document.body) {
        this.focusHistory.push(target);
        if (this.focusHistory.length > 10) {
          this.focusHistory.shift();
        }
      }
    });

    // Ensure visible focus indicators
    document.addEventListener('mousedown', () => {
      document.body.classList.add('using-mouse');
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        document.body.classList.remove('using-mouse');
      }
    });
  }

  private showSkipLinks(): void {
    const skipLinks = document.querySelector('.skip-links') as HTMLElement;
    if (skipLinks) {
      skipLinks.style.display = 'block';
      const firstLink = skipLinks.querySelector('a') as HTMLAnchorElement;
      if (firstLink) {
        firstLink.focus();
      }
    }
  }

  private handleEscapeKey(): void {
    // Close modals
    const openModal = document.querySelector('.modal[style*="flex"], .modal.show');
    if (openModal) {
      const closeButton = openModal.querySelector('.modal-close, [data-dismiss="modal"]') as HTMLElement;
      if (closeButton) {
        closeButton.click();
      }
    }

    // Close dropdowns
    const openDropdown = document.querySelector('.dropdown.open, .dropdown.show');
    if (openDropdown) {
      openDropdown.classList.remove('open', 'show');
    }
  }

  private handleTabNavigation(event: KeyboardEvent): void {
    const modal = document.querySelector('.modal[style*="flex"], .modal.show');
    if (modal) {
      this.trapFocusInModal(event, modal as HTMLElement);
    }
  }

  private trapFocusInModal(event: KeyboardEvent, modal: HTMLElement): void {
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  private handleArrowNavigation(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    
    // Handle radio button navigation
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'radio') {
      this.handleRadioNavigation(event, target as HTMLInputElement);
    }

    // Handle custom select components
    if (target.getAttribute('role') === 'listbox' || target.closest('[role="listbox"]')) {
      this.handleListboxNavigation(event);
    }
  }

  private handleRadioNavigation(event: KeyboardEvent, radio: HTMLInputElement): void {
    const radioGroup = document.querySelectorAll(`input[name="${radio.name}"][type="radio"]`);
    const currentIndex = Array.from(radioGroup).indexOf(radio);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % radioGroup.length;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + radioGroup.length) % radioGroup.length;
    }

    if (nextIndex !== currentIndex) {
      event.preventDefault();
      const nextRadio = radioGroup[nextIndex] as HTMLInputElement;
      nextRadio.checked = true;
      nextRadio.focus();
      nextRadio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  private handleListboxNavigation(event: KeyboardEvent): void {
    const listbox = (event.target as HTMLElement).closest('[role="listbox"]') as HTMLElement;
    if (!listbox) return;

    const options = listbox.querySelectorAll('[role="option"]');
    const currentOption = listbox.querySelector('[aria-selected="true"]') || options[0];
    const currentIndex = Array.from(options).indexOf(currentOption as Element);
    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowDown':
        nextIndex = Math.min(currentIndex + 1, options.length - 1);
        break;
      case 'ArrowUp':
        nextIndex = Math.max(currentIndex - 1, 0);
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = options.length - 1;
        break;
      default:
        return;
    }

    if (nextIndex !== currentIndex) {
      event.preventDefault();
      
      // Update selection
      options.forEach(option => option.setAttribute('aria-selected', 'false'));
      options[nextIndex].setAttribute('aria-selected', 'true');
      (options[nextIndex] as HTMLElement).focus();
    }
  }

  // Color contrast utilities
  static checkColorContrast(foreground: string, background: string): number {
    const getLuminance = (color: string): number => {
      const rgb = this.hexToRgb(color);
      if (!rgb) return 0;

      const [r, g, b] = rgb.map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });

      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const l1 = getLuminance(foreground);
    const l2 = getLuminance(background);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  private static hexToRgb(hex: string): [number, number, number] | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : null;
  }

  // Form accessibility helpers
  enhanceFormAccessibility(form: HTMLFormElement): void {
    const inputs = form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      const inputElement = input as HTMLInputElement;
      
      // Ensure labels are properly associated
      if (!inputElement.getAttribute('aria-label') && !inputElement.getAttribute('aria-labelledby')) {
        const label = form.querySelector(`label[for="${inputElement.id}"]`);
        if (!label && inputElement.id) {
          logger.warn(`Input ${inputElement.id} missing proper label`, 'ACCESSIBILITY');
        }
      }

      // Add required indicators
      if (inputElement.required) {
        inputElement.setAttribute('aria-required', 'true');
        
        // Add visual indicator if not present
        const label = form.querySelector(`label[for="${inputElement.id}"]`);
        if (label && !label.querySelector('.required-indicator')) {
          const indicator = document.createElement('span');
          indicator.className = 'required-indicator';
          indicator.textContent = ' *';
          indicator.setAttribute('aria-hidden', 'true');
          label.appendChild(indicator);
        }
      }

      // Enhance error messaging
      const errorElement = form.querySelector(`[data-error-for="${inputElement.name || inputElement.id}"]`);
      if (errorElement) {
        const errorId = `${inputElement.id || inputElement.name}-error`;
        errorElement.id = errorId;
        inputElement.setAttribute('aria-describedby', errorId);
      }
    });
  }

  // Modal accessibility
  openModal(modal: HTMLElement, trigger?: HTMLElement): void {
    // Store the trigger element
    if (trigger) {
      modal.dataset.trigger = trigger.id || 'unknown';
    }

    // Set focus to modal
    modal.setAttribute('aria-hidden', 'false');
    
    // Focus first focusable element or modal itself
    const firstFocusable = modal.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement;
    
    if (firstFocusable) {
      firstFocusable.focus();
    } else {
      modal.focus();
    }

    // Announce modal opening
    const modalTitle = modal.querySelector('h1, h2, h3, .modal-title')?.textContent;
    if (modalTitle) {
      this.announce(`Dialog opened: ${modalTitle}`);
    }
  }

  closeModal(modal: HTMLElement): void {
    modal.setAttribute('aria-hidden', 'true');
    
    // Return focus to trigger element
    const triggerId = modal.dataset.trigger;
    if (triggerId && triggerId !== 'unknown') {
      const trigger = document.getElementById(triggerId);
      if (trigger) {
        trigger.focus();
      }
    } else {
      // Fallback to previous focused element
      const lastFocused = this.focusHistory[this.focusHistory.length - 2];
      if (lastFocused && document.contains(lastFocused)) {
        lastFocused.focus();
      }
    }

    this.announce('Dialog closed');
  }

  // Live region updates
  updateLiveRegion(regionId: string, message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const region = document.getElementById(regionId);
    if (region) {
      region.setAttribute('aria-live', priority);
      region.textContent = message;
    }
  }

  // Skip links setup
  setupSkipLinks(): void {
    const skipLinks = document.createElement('div');
    skipLinks.className = 'skip-links';
    skipLinks.innerHTML = `
      <a href="#main-content" class="skip-link">Skip to main content</a>
      <a href="#navigation" class="skip-link">Skip to navigation</a>
      <a href="#footer" class="skip-link">Skip to footer</a>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .skip-links {
        position: absolute;
        top: -40px;
        left: 6px;
        z-index: 1000;
      }
      .skip-link {
        position: absolute;
        top: -40px;
        left: 6px;
        background: #000;
        color: #fff;
        padding: 8px;
        text-decoration: none;
        border-radius: 4px;
        z-index: 1001;
      }
      .skip-link:focus {
        top: 6px;
      }
    `;

    document.head.appendChild(style);
    document.body.insertBefore(skipLinks, document.body.firstChild);
  }

  // Validate accessibility
  validatePage(): void {
    const issues: string[] = [];

    // Check for missing alt text
    const images = document.querySelectorAll('img:not([alt])');
    if (images.length > 0) {
      issues.push(`${images.length} images missing alt text`);
    }

    // Check for missing form labels
    const unlabeledInputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
    unlabeledInputs.forEach(input => {
      const id = (input as HTMLInputElement).id;
      if (id && !document.querySelector(`label[for="${id}"]`)) {
        issues.push(`Input ${id} missing label`);
      }
    });

    // Check heading hierarchy
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let lastLevel = 0;
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.charAt(1));
      if (level > lastLevel + 1) {
        issues.push(`Heading level skipped: ${heading.tagName} after h${lastLevel}`);
      }
      lastLevel = level;
    });

    if (issues.length > 0) {
      logger.warn('Accessibility issues found', 'ACCESSIBILITY', { issues });
    } else {
      logger.info('No accessibility issues found', 'ACCESSIBILITY');
    }
  }
}

// Initialize accessibility manager
export const accessibilityManager = AccessibilityManager.getInstance();
