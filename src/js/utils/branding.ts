// Dynamic Branding and Theming System
// Allows runtime customization of colors, fonts, and visual elements

import { institutionConfig } from '../config/institution.ts';

export interface BrandingTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
  };
  fonts: {
    primary: string;
    secondary: string;
    monospace: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
}

export const defaultLightTheme: BrandingTheme = {
  colors: {
    primary: '#1e40af',
    secondary: '#3b82f6',
    accent: '#f59e0b',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#1f2937',
    textSecondary: '#6b7280',
  },
  fonts: {
    primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    secondary: 'Georgia, "Times New Roman", serif',
    monospace: '"SF Mono", Monaco, "Cascadia Code", monospace',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  },
};

export const defaultDarkTheme: BrandingTheme = {
  ...defaultLightTheme,
  colors: {
    primary: '#3b82f6',
    secondary: '#60a5fa',
    accent: '#fbbf24',
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    background: '#111827',
    surface: '#1f2937',
    text: '#f9fafb',
    textSecondary: '#d1d5db',
  },
};

export class BrandingManager {
  private static instance: BrandingManager;
  private currentTheme: BrandingTheme;
  private isDarkMode: boolean = false;

  private constructor() {
    this.currentTheme = this.loadTheme();
    this.detectSystemTheme();
    this.applyTheme();
  }

  public static getInstance(): BrandingManager {
    if (!BrandingManager.instance) {
      BrandingManager.instance = new BrandingManager();
    }
    return BrandingManager.instance;
  }

  private loadTheme(): BrandingTheme {
    const config = institutionConfig.getConfig();
    const baseTheme = this.isDarkMode ? defaultDarkTheme : defaultLightTheme;
    
    // Override with institution-specific colors
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: config.primaryColor,
        secondary: config.secondaryColor,
        accent: config.accentColor,
      },
    };
  }

  private detectSystemTheme(): void {
    if (typeof window === 'undefined') return;
    
    // Check for saved preference
    const savedTheme = localStorage.getItem('theme-preference');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
      return;
    }
    
    // Check system preference
    if (window.matchMedia) {
      this.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      // Listen for changes
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        this.setDarkMode(e.matches);
      });
    }
  }

  public applyTheme(): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    
    // Apply CSS custom properties
    Object.entries(this.currentTheme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    
    Object.entries(this.currentTheme.fonts).forEach(([key, value]) => {
      root.style.setProperty(`--font-${key}`, value);
    });
    
    Object.entries(this.currentTheme.spacing).forEach(([key, value]) => {
      root.style.setProperty(`--spacing-${key}`, value);
    });
    
    Object.entries(this.currentTheme.borderRadius).forEach(([key, value]) => {
      root.style.setProperty(`--radius-${key}`, value);
    });
    
    Object.entries(this.currentTheme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value);
    });
    
    // Apply theme class to body
    document.body.classList.toggle('dark-theme', this.isDarkMode);
    document.body.classList.toggle('light-theme', !this.isDarkMode);
  }

  public setDarkMode(isDark: boolean): void {
    this.isDarkMode = isDark;
    this.currentTheme = this.loadTheme();
    this.applyTheme();
    
    // Save preference
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('theme-preference', isDark ? 'dark' : 'light');
    }
  }

  public toggleDarkMode(): void {
    this.setDarkMode(!this.isDarkMode);
  }

  public updateColors(colors: Partial<BrandingTheme['colors']>): void {
    this.currentTheme.colors = { ...this.currentTheme.colors, ...colors };
    this.applyTheme();
  }

  public updateInstitutionBranding(): void {
    const config = institutionConfig.getConfig();
    this.updateColors({
      primary: config.primaryColor,
      secondary: config.secondaryColor,
      accent: config.accentColor,
    });
  }

  public getCurrentTheme(): BrandingTheme {
    return { ...this.currentTheme };
  }

  public isDark(): boolean {
    return this.isDarkMode;
  }

  public generateCSS(): string {
    const theme = this.currentTheme;
    
    return `
      :root {
        /* Colors */
        ${Object.entries(theme.colors).map(([key, value]) => 
          `--color-${key}: ${value};`
        ).join('\n        ')}
        
        /* Fonts */
        ${Object.entries(theme.fonts).map(([key, value]) => 
          `--font-${key}: ${value};`
        ).join('\n        ')}
        
        /* Spacing */
        ${Object.entries(theme.spacing).map(([key, value]) => 
          `--spacing-${key}: ${value};`
        ).join('\n        ')}
        
        /* Border Radius */
        ${Object.entries(theme.borderRadius).map(([key, value]) => 
          `--radius-${key}: ${value};`
        ).join('\n        ')}
        
        /* Shadows */
        ${Object.entries(theme.shadows).map(([key, value]) => 
          `--shadow-${key}: ${value};`
        ).join('\n        ')}
      }
      
      /* Base styles */
      body {
        font-family: var(--font-primary);
        background-color: var(--color-background);
        color: var(--color-text);
        transition: background-color 0.3s ease, color 0.3s ease;
      }
      
      /* Button styles */
      .btn {
        font-family: var(--font-primary);
        border-radius: var(--radius-md);
        padding: var(--spacing-sm) var(--spacing-md);
        transition: all 0.2s ease;
        border: none;
        cursor: pointer;
        font-weight: 500;
      }
      
      .btn-primary {
        background-color: var(--color-primary);
        color: white;
      }
      
      .btn-primary:hover {
        background-color: var(--color-secondary);
        transform: translateY(-1px);
        box-shadow: var(--shadow-md);
      }
      
      .btn-secondary {
        background-color: var(--color-surface);
        color: var(--color-text);
        border: 1px solid var(--color-primary);
      }
      
      .btn-secondary:hover {
        background-color: var(--color-primary);
        color: white;
      }
      
      /* Card styles */
      .card {
        background-color: var(--color-surface);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
        padding: var(--spacing-lg);
        transition: box-shadow 0.2s ease;
      }
      
      .card:hover {
        box-shadow: var(--shadow-md);
      }
      
      /* Form styles */
      .form-input {
        font-family: var(--font-primary);
        border: 1px solid var(--color-textSecondary);
        border-radius: var(--radius-md);
        padding: var(--spacing-sm) var(--spacing-md);
        background-color: var(--color-background);
        color: var(--color-text);
        transition: border-color 0.2s ease;
      }
      
      .form-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      
      /* Status indicators */
      .status-success {
        color: var(--color-success);
      }
      
      .status-warning {
        color: var(--color-warning);
      }
      
      .status-error {
        color: var(--color-error);
      }
      
      /* Dark mode specific styles */
      .dark-theme .card {
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .dark-theme .form-input {
        border-color: rgba(255, 255, 255, 0.2);
        background-color: var(--color-surface);
      }
    `;
  }
}

// Utility functions for component styling
export const getThemeColor = (colorName: keyof BrandingTheme['colors']): string => {
  const branding = BrandingManager.getInstance();
  return branding.getCurrentTheme().colors[colorName];
};

export const getThemeFont = (fontName: keyof BrandingTheme['fonts']): string => {
  const branding = BrandingManager.getInstance();
  return branding.getCurrentTheme().fonts[fontName];
};

export const getThemeSpacing = (spacingName: keyof BrandingTheme['spacing']): string => {
  const branding = BrandingManager.getInstance();
  return branding.getCurrentTheme().spacing[spacingName];
};

// Initialize branding system
export const brandingManager = BrandingManager.getInstance();

// Auto-apply theme on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    brandingManager.applyTheme();
  });
}
