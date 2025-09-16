// Institution Configuration System
// Allows easy customization for different organizations

export interface InstitutionConfig {
  name: string;
  shortName: string;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  domain: string;
  contactEmail: string;
  website: string;
  description: string;
  branding: {
    favicon: string;
    headerLogo: string;
    footerLogo: string;
    backgroundImage?: string;
  };
  features: {
    allowPublicVoting: boolean;
    requireEmailVerification: boolean;
    enableRealTimeResults: boolean;
    allowAnonymousVoting: boolean;
    maxCandidatesPerElection: number;
    maxElectionsPerOrganization: number;
  };
  customization: {
    welcomeMessage: string;
    votingInstructions: string;
    termsOfService: string;
    privacyPolicy: string;
  };
}

// Default configuration (Murang'a University as template)
export const DEFAULT_INSTITUTION_CONFIG: InstitutionConfig = {
  name: "Murang'a University of Technology",
  shortName: "MUT",
  logo: "/assets/logos/mut-logo.png",
  primaryColor: "#1e40af",
  secondaryColor: "#3b82f6",
  accentColor: "#f59e0b",
  domain: "mut.ac.ke",
  contactEmail: "elections@mut.ac.ke",
  website: "https://mut.ac.ke",
  description: "Leading technological university in Kenya",
  branding: {
    favicon: "/assets/favicons/mut-favicon.ico",
    headerLogo: "/assets/logos/mut-header.png",
    footerLogo: "/assets/logos/mut-footer.png",
  },
  features: {
    allowPublicVoting: false,
    requireEmailVerification: true,
    enableRealTimeResults: true,
    allowAnonymousVoting: false,
    maxCandidatesPerElection: 10,
    maxElectionsPerOrganization: 50,
  },
  customization: {
    welcomeMessage: "Welcome to MUT Student Elections",
    votingInstructions: "Please select your preferred candidate and confirm your vote. Your vote is anonymous and secure.",
    termsOfService: "By participating in this election, you agree to the university's election guidelines.",
    privacyPolicy: "Your voting data is encrypted and stored securely on the blockchain.",
  },
};

// Configuration manager class
export class InstitutionConfigManager {
  private static instance: InstitutionConfigManager;
  private config: InstitutionConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): InstitutionConfigManager {
    if (!InstitutionConfigManager.instance) {
      InstitutionConfigManager.instance = new InstitutionConfigManager();
    }
    return InstitutionConfigManager.instance;
  }

  private loadConfig(): InstitutionConfig {
    // Try to load from environment variables first
    const envConfig = this.loadFromEnvironment();
    if (envConfig) {
      return { ...DEFAULT_INSTITUTION_CONFIG, ...envConfig };
    }

    // Try to load from local storage (for client-side customization)
    if (typeof window !== 'undefined') {
      const savedConfig = localStorage.getItem('institution_config');
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig);
          return { ...DEFAULT_INSTITUTION_CONFIG, ...parsed };
        } catch (error) {
          console.warn('Failed to parse saved institution config:', error);
        }
      }
    }

    // Fall back to default config
    return DEFAULT_INSTITUTION_CONFIG;
  }

  private loadFromEnvironment(): Partial<InstitutionConfig> | null {
    if (typeof process === 'undefined' || !process.env) {
      return null;
    }

    const envConfig: Partial<InstitutionConfig> = {};

    // Basic info
    if (process.env.VITE_INSTITUTION_NAME) envConfig.name = process.env.VITE_INSTITUTION_NAME;
    if (process.env.VITE_INSTITUTION_SHORT_NAME) envConfig.shortName = process.env.VITE_INSTITUTION_SHORT_NAME;
    if (process.env.VITE_INSTITUTION_DOMAIN) envConfig.domain = process.env.VITE_INSTITUTION_DOMAIN;
    if (process.env.VITE_INSTITUTION_EMAIL) envConfig.contactEmail = process.env.VITE_INSTITUTION_EMAIL;
    if (process.env.VITE_INSTITUTION_WEBSITE) envConfig.website = process.env.VITE_INSTITUTION_WEBSITE;

    // Colors
    if (process.env.VITE_PRIMARY_COLOR) envConfig.primaryColor = process.env.VITE_PRIMARY_COLOR;
    if (process.env.VITE_SECONDARY_COLOR) envConfig.secondaryColor = process.env.VITE_SECONDARY_COLOR;
    if (process.env.VITE_ACCENT_COLOR) envConfig.accentColor = process.env.VITE_ACCENT_COLOR;

    // Features
    if (process.env.VITE_ALLOW_PUBLIC_VOTING) {
      envConfig.features = {
        ...DEFAULT_INSTITUTION_CONFIG.features,
        allowPublicVoting: process.env.VITE_ALLOW_PUBLIC_VOTING === 'true',
      };
    }

    return Object.keys(envConfig).length > 0 ? envConfig : null;
  }

  public getConfig(): InstitutionConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<InstitutionConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('institution_config', JSON.stringify(updates));
    }

    // Apply CSS custom properties for theming
    this.applyCSSVariables();
  }

  private applyCSSVariables(): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.style.setProperty('--primary-color', this.config.primaryColor);
    root.style.setProperty('--secondary-color', this.config.secondaryColor);
    root.style.setProperty('--accent-color', this.config.accentColor);
  }

  public resetToDefault(): void {
    this.config = { ...DEFAULT_INSTITUTION_CONFIG };
    if (typeof window !== 'undefined') {
      localStorage.removeItem('institution_config');
    }
    this.applyCSSVariables();
  }

  // Utility methods for common operations
  public getInstitutionName(): string {
    return this.config.name;
  }

  public getShortName(): string {
    return this.config.shortName;
  }

  public getPrimaryColor(): string {
    return this.config.primaryColor;
  }

  public getLogo(): string {
    return this.config.logo;
  }

  public isFeatureEnabled(feature: keyof InstitutionConfig['features']): boolean {
    return this.config.features[feature] as boolean;
  }

  public getCustomMessage(type: keyof InstitutionConfig['customization']): string {
    return this.config.customization[type];
  }
}

// Export singleton instance
export const institutionConfig = InstitutionConfigManager.getInstance();
