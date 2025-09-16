/**
 * WCAG 2.1 AA Compliance System for Accessible Voting
 * Implements comprehensive accessibility features for all users
 */

export interface AccessibilityOptions {
  highContrast: boolean;
  largeText: boolean;
  screenReader: boolean;
  keyboardOnly: boolean;
  reducedMotion: boolean;
  colorBlindFriendly: boolean;
  voiceNavigation: boolean;
  language: string;
}

export interface AccessibilityAudit {
  level: 'A' | 'AA' | 'AAA';
  passed: boolean;
  issues: AccessibilityIssue[];
  score: number;
}

export interface AccessibilityIssue {
  severity: 'error' | 'warning' | 'info';
  guideline: string;
  element: string;
  description: string;
  solution: string;
}

/**
 * WCAG Compliance Manager
 * Ensures voting interface meets accessibility standards
 */
export class WCAGComplianceManager {
  private options: AccessibilityOptions;
  private announcements: HTMLElement | null = null;

  constructor() {
    this.options = this.loadAccessibilityPreferences();
    this.initializeAccessibility();
  }

  /**
   * Initialize accessibility features
   */
  private initializeAccessibility(): void {
    this.createScreenReaderAnnouncements();
    this.setupKeyboardNavigation();
    this.applyAccessibilityOptions();
    this.setupFocusManagement();
    this.addSkipLinks();
  }

  /**
   * Create screen reader announcement region
   */
  private createScreenReaderAnnouncements(): void {
    this.announcements = document.createElement('div');
    this.announcements.setAttribute('aria-live', 'polite');
    this.announcements.setAttribute('aria-atomic', 'true');
    this.announcements.setAttribute('id', 'accessibility-announcements');
    this.announcements.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;
    document.body.appendChild(this.announcements);
  }

  /**
   * Announce message to screen readers
   * @param message Message to announce
   * @param priority Announcement priority
   */
  announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.announcements) return;

    this.announcements.setAttribute('aria-live', priority);
    this.announcements.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (this.announcements) {
        this.announcements.textContent = '';
      }
    }, 1000);
  }

  /**
   * Setup comprehensive keyboard navigation
   */
  private setupKeyboardNavigation(): void {
    // Global keyboard event handler
    document.addEventListener('keydown', (event) => {
      this.handleKeyboardNavigation(event);
    });

    // Focus visible indicator
    const style = document.createElement('style');
    style.textContent = `
      *:focus {
        outline: 3px solid #4A90E2 !important;
        outline-offset: 2px !important;
      }
      
      .skip-link:focus {
        position: absolute;
        top: 10px;
        left: 10px;
        background: #000;
        color: #fff;
        padding: 8px 16px;
        text-decoration: none;
        z-index: 9999;
        border-radius: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Handle keyboard navigation events
   * @param event Keyboard event
   */
  private handleKeyboardNavigation(event: KeyboardEvent): void {
    const { key, ctrlKey, altKey } = event;

    // Skip to main content (Alt + M)
    if (altKey && key.toLowerCase() === 'm') {
      event.preventDefault();
      this.skipToMainContent();
      return;
    }

    // Skip to navigation (Alt + N)
    if (altKey && key.toLowerCase() === 'n') {
      event.preventDefault();
      this.skipToNavigation();
      return;
    }

    // Announce current focus (Alt + F)
    if (altKey && key.toLowerCase() === 'f') {
      event.preventDefault();
      this.announceCurrentFocus();
      return;
    }

    // Toggle high contrast (Alt + H)
    if (altKey && key.toLowerCase() === 'h') {
      event.preventDefault();
      this.toggleHighContrast();
      return;
    }

    // Increase text size (Ctrl + Plus)
    if (ctrlKey && key === '+') {
      event.preventDefault();
      this.increaseTextSize();
      return;
    }

    // Decrease text size (Ctrl + Minus)
    if (ctrlKey && key === '-') {
      event.preventDefault();
      this.decreaseTextSize();
      return;
    }

    // Handle voting interface navigation
    if (document.querySelector('.voting-interface')) {
      this.handleVotingKeyboardNavigation(event);
    }
  }

  /**
   * Handle voting-specific keyboard navigation
   * @param event Keyboard event
   */
  private handleVotingKeyboardNavigation(event: KeyboardEvent): void {
    const { key, target } = event;
    const currentElement = target as HTMLElement;

    // Space or Enter to select candidate
    if ((key === ' ' || key === 'Enter') && currentElement.classList.contains('candidate-option')) {
      event.preventDefault();
      this.selectCandidate(currentElement);
      return;
    }

    // Arrow keys for candidate navigation
    if (['ArrowUp', 'ArrowDown'].includes(key)) {
      event.preventDefault();
      this.navigateCandidates(key === 'ArrowDown' ? 'next' : 'previous');
      return;
    }

    // V key to cast vote
    if (key.toLowerCase() === 'v' && event.altKey) {
      event.preventDefault();
      this.castVoteKeyboard();
      return;
    }
  }

  /**
   * Apply accessibility options to interface
   */
  private applyAccessibilityOptions(): void {
    const { highContrast, largeText, reducedMotion, colorBlindFriendly } = this.options;

    // High contrast mode
    if (highContrast) {
      document.body.classList.add('high-contrast');
    }

    // Large text mode
    if (largeText) {
      document.body.classList.add('large-text');
    }

    // Reduced motion
    if (reducedMotion) {
      document.body.classList.add('reduced-motion');
    }

    // Color blind friendly
    if (colorBlindFriendly) {
      document.body.classList.add('color-blind-friendly');
    }

    // Add CSS for accessibility modes
    this.addAccessibilityCSS();
  }

  /**
   * Add accessibility CSS styles
   */
  private addAccessibilityCSS(): void {
    const style = document.createElement('style');
    style.textContent = `
      /* High Contrast Mode */
      .high-contrast {
        filter: contrast(150%);
      }
      
      .high-contrast .card {
        border: 2px solid #000 !important;
        background: #fff !important;
        color: #000 !important;
      }
      
      .high-contrast .btn-primary {
        background: #000 !important;
        color: #fff !important;
        border: 2px solid #000 !important;
      }
      
      /* Large Text Mode */
      .large-text {
        font-size: 120% !important;
      }
      
      .large-text .btn {
        padding: 12px 24px !important;
        font-size: 18px !important;
      }
      
      /* Reduced Motion */
      .reduced-motion * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
      
      /* Color Blind Friendly */
      .color-blind-friendly .status-success {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z'/%3E%3C/svg%3E") !important;
        background-repeat: no-repeat !important;
        background-position: left center !important;
        padding-left: 20px !important;
      }
      
      .color-blind-friendly .status-error {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E") !important;
        background-repeat: no-repeat !important;
        background-position: left center !important;
        padding-left: 20px !important;
      }
      
      /* Skip Links */
      .skip-link {
        position: absolute;
        top: -40px;
        left: 6px;
        background: #000;
        color: #fff;
        padding: 8px;
        text-decoration: none;
        z-index: 9999;
      }
      
      .skip-link:focus {
        top: 6px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Add skip navigation links
   */
  private addSkipLinks(): void {
    const skipLinks = document.createElement('div');
    skipLinks.innerHTML = `
      <a href="#main-content" class="skip-link">Skip to main content</a>
      <a href="#navigation" class="skip-link">Skip to navigation</a>
      <a href="#voting-section" class="skip-link">Skip to voting section</a>
    `;
    document.body.insertBefore(skipLinks, document.body.firstChild);
  }

  /**
   * Setup proper focus management
   */
  private setupFocusManagement(): void {
    // Focus trap for modals
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        const modal = document.querySelector('.modal:not([style*="display: none"])') as HTMLElement;
        if (modal) {
          this.trapFocus(event, modal);
        }
      }
    });

    // Focus restoration
    let lastFocusedElement: HTMLElement | null = null;
    
    document.addEventListener('focusin', (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.modal')) {
        lastFocusedElement = target;
      }
    });

    // Restore focus when modal closes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const target = mutation.target as HTMLElement;
          if (target.classList.contains('modal') && target.style.display === 'none') {
            if (lastFocusedElement) {
              lastFocusedElement.focus();
            }
          }
        }
      });
    });

    document.querySelectorAll('.modal').forEach((modal) => {
      observer.observe(modal, { attributes: true });
    });
  }

  /**
   * Trap focus within element
   * @param event Keyboard event
   * @param element Container element
   */
  private trapFocus(event: KeyboardEvent, element: HTMLElement): void {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }
  }

  /**
   * Make voting interface accessible
   * @param container Voting interface container
   */
  makeVotingInterfaceAccessible(container: HTMLElement): void {
    // Add proper ARIA labels and roles
    const candidates = container.querySelectorAll('.candidate-option');
    candidates.forEach((candidate, index) => {
      const radio = candidate.querySelector('input[type="radio"]') as HTMLInputElement;
      const label = candidate.querySelector('.candidate-name')?.textContent || `Candidate ${index + 1}`;
      
      if (radio) {
        radio.setAttribute('aria-label', `Vote for ${label}`);
        radio.setAttribute('aria-describedby', `candidate-${index}-description`);
      }

      // Add description for screen readers
      const description = candidate.querySelector('.candidate-description');
      if (description) {
        description.id = `candidate-${index}-description`;
      }
    });

    // Make vote button accessible
    const voteButton = container.querySelector('.vote-button') as HTMLButtonElement;
    if (voteButton) {
      voteButton.setAttribute('aria-label', 'Cast your vote');
      voteButton.setAttribute('aria-describedby', 'vote-instructions');
      
      // Add instructions
      const instructions = document.createElement('div');
      instructions.id = 'vote-instructions';
      instructions.className = 'sr-only';
      instructions.textContent = 'Select a candidate above, then press this button to cast your vote';
      voteButton.parentNode?.insertBefore(instructions, voteButton);
    }

    // Add election information for screen readers
    const electionTitle = container.querySelector('.election-title');
    if (electionTitle) {
      electionTitle.setAttribute('role', 'heading');
      electionTitle.setAttribute('aria-level', '1');
    }

    // Add voting status announcements
    this.setupVotingStatusAnnouncements(container);
  }

  /**
   * Setup voting status announcements
   * @param container Voting interface container
   */
  private setupVotingStatusAnnouncements(container: HTMLElement): void {
    const candidates = container.querySelectorAll('input[type="radio"]');
    candidates.forEach((radio) => {
      radio.addEventListener('change', () => {
        const label = radio.getAttribute('aria-label') || 'Candidate selected';
        this.announceToScreenReader(`${label} selected`);
      });
    });

    const voteButton = container.querySelector('.vote-button');
    if (voteButton) {
      voteButton.addEventListener('click', () => {
        this.announceToScreenReader('Casting your vote, please wait...', 'assertive');
      });
    }
  }

  /**
   * Perform WCAG compliance audit
   * @param level Compliance level to check
   * @returns Audit results
   */
  performAccessibilityAudit(level: 'A' | 'AA' | 'AAA' = 'AA'): AccessibilityAudit {
    const issues: AccessibilityIssue[] = [];

    // Check images for alt text
    document.querySelectorAll('img').forEach((img, index) => {
      if (!img.getAttribute('alt')) {
        issues.push({
          severity: 'error',
          guideline: 'WCAG 1.1.1',
          element: `img[${index}]`,
          description: 'Image missing alt text',
          solution: 'Add descriptive alt attribute to image'
        });
      }
    });

    // Check form labels
    document.querySelectorAll('input, select, textarea').forEach((input, index) => {
      const id = input.id;
      const label = document.querySelector(`label[for="${id}"]`);
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledby = input.getAttribute('aria-labelledby');

      if (!label && !ariaLabel && !ariaLabelledby) {
        issues.push({
          severity: 'error',
          guideline: 'WCAG 1.3.1',
          element: `${input.tagName.toLowerCase()}[${index}]`,
          description: 'Form control missing label',
          solution: 'Add label element or aria-label attribute'
        });
      }
    });

    // Check color contrast (simplified check)
    const contrastIssues = this.checkColorContrast();
    issues.push(...contrastIssues);

    // Check keyboard accessibility
    const keyboardIssues = this.checkKeyboardAccessibility();
    issues.push(...keyboardIssues);

    // Check heading structure
    const headingIssues = this.checkHeadingStructure();
    issues.push(...headingIssues);

    // Calculate score
    const totalChecks = 20; // Simplified for demo
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const score = Math.max(0, (totalChecks - errorCount) / totalChecks * 100);

    return {
      level,
      passed: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      score
    };
  }

  /**
   * Check color contrast ratios
   */
  private checkColorContrast(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    
    // This would require actual color analysis
    // For demo, we'll check for common issues
    const elements = document.querySelectorAll('button, a, .text-muted');
    elements.forEach((element, index) => {
      const styles = window.getComputedStyle(element);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;
      
      // Simplified check - in reality, you'd calculate actual contrast ratios
      if (color === 'rgb(128, 128, 128)' && backgroundColor === 'rgb(255, 255, 255)') {
        issues.push({
          severity: 'warning',
          guideline: 'WCAG 1.4.3',
          element: `${element.tagName.toLowerCase()}[${index}]`,
          description: 'Insufficient color contrast ratio',
          solution: 'Increase contrast between text and background colors'
        });
      }
    });

    return issues;
  }

  /**
   * Check keyboard accessibility
   */
  private checkKeyboardAccessibility(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];

    // Check for keyboard traps
    const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
    interactiveElements.forEach((element, index) => {
      const tabIndex = element.getAttribute('tabindex');
      if (tabIndex && parseInt(tabIndex) > 0) {
        issues.push({
          severity: 'warning',
          guideline: 'WCAG 2.4.3',
          element: `${element.tagName.toLowerCase()}[${index}]`,
          description: 'Positive tabindex may create keyboard trap',
          solution: 'Use tabindex="0" or remove tabindex attribute'
        });
      }
    });

    return issues;
  }

  /**
   * Check heading structure
   */
  private checkHeadingStructure(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    let previousLevel = 0;
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1));
      
      if (level > previousLevel + 1) {
        issues.push({
          severity: 'warning',
          guideline: 'WCAG 1.3.1',
          element: `${heading.tagName.toLowerCase()}[${index}]`,
          description: 'Heading level skipped',
          solution: 'Use heading levels in sequential order'
        });
      }
      
      previousLevel = level;
    });

    return issues;
  }

  // Helper methods for keyboard navigation

  private skipToMainContent(): void {
    const mainContent = document.getElementById('main-content') || document.querySelector('main');
    if (mainContent) {
      mainContent.focus();
      this.announceToScreenReader('Skipped to main content');
    }
  }

  private skipToNavigation(): void {
    const navigation = document.getElementById('navigation') || document.querySelector('nav');
    if (navigation) {
      navigation.focus();
      this.announceToScreenReader('Skipped to navigation');
    }
  }

  private announceCurrentFocus(): void {
    const activeElement = document.activeElement as HTMLElement;
    const label = activeElement.getAttribute('aria-label') || 
                 activeElement.textContent || 
                 activeElement.tagName.toLowerCase();
    this.announceToScreenReader(`Currently focused on: ${label}`);
  }

  private toggleHighContrast(): void {
    this.options.highContrast = !this.options.highContrast;
    document.body.classList.toggle('high-contrast', this.options.highContrast);
    this.saveAccessibilityPreferences();
    this.announceToScreenReader(`High contrast ${this.options.highContrast ? 'enabled' : 'disabled'}`);
  }

  private increaseTextSize(): void {
    const currentSize = parseInt(getComputedStyle(document.body).fontSize);
    const newSize = Math.min(currentSize + 2, 24);
    document.body.style.fontSize = `${newSize}px`;
    this.announceToScreenReader(`Text size increased to ${newSize} pixels`);
  }

  private decreaseTextSize(): void {
    const currentSize = parseInt(getComputedStyle(document.body).fontSize);
    const newSize = Math.max(currentSize - 2, 12);
    document.body.style.fontSize = `${newSize}px`;
    this.announceToScreenReader(`Text size decreased to ${newSize} pixels`);
  }

  private selectCandidate(candidateElement: HTMLElement): void {
    const radio = candidateElement.querySelector('input[type="radio"]') as HTMLInputElement;
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
    }
  }

  private navigateCandidates(direction: 'next' | 'previous'): void {
    const candidates = Array.from(document.querySelectorAll('.candidate-option')) as HTMLElement[];
    const currentIndex = candidates.findIndex(c => c.contains(document.activeElement));
    
    let nextIndex;
    if (direction === 'next') {
      nextIndex = currentIndex < candidates.length - 1 ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : candidates.length - 1;
    }
    
    candidates[nextIndex].focus();
  }

  private castVoteKeyboard(): void {
    const voteButton = document.querySelector('.vote-button') as HTMLButtonElement;
    if (voteButton && !voteButton.disabled) {
      voteButton.click();
    } else {
      this.announceToScreenReader('Please select a candidate before voting', 'assertive');
    }
  }

  private loadAccessibilityPreferences(): AccessibilityOptions {
    const stored = localStorage.getItem('accessibility-preferences');
    return stored ? JSON.parse(stored) : {
      highContrast: false,
      largeText: false,
      screenReader: false,
      keyboardOnly: false,
      reducedMotion: false,
      colorBlindFriendly: false,
      voiceNavigation: false,
      language: 'en'
    };
  }

  private saveAccessibilityPreferences(): void {
    localStorage.setItem('accessibility-preferences', JSON.stringify(this.options));
  }

  /**
   * Get accessibility preferences
   */
  getAccessibilityOptions(): AccessibilityOptions {
    return { ...this.options };
  }

  /**
   * Update accessibility preferences
   * @param options New accessibility options
   */
  updateAccessibilityOptions(options: Partial<AccessibilityOptions>): void {
    this.options = { ...this.options, ...options };
    this.applyAccessibilityOptions();
    this.saveAccessibilityPreferences();
  }
}
