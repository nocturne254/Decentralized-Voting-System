// Modern validation utilities with Zod-like schema validation
import type { ValidationResult, FormValidationSchema, FieldValidation } from '@/types';

export class Validator {
  static email(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  static required(value: any): boolean {
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    return value != null && value !== undefined;
  }

  static minLength(value: string, min: number): boolean {
    return value.length >= min;
  }

  static maxLength(value: string, max: number): boolean {
    return value.length <= max;
  }

  static pattern(value: string, regex: RegExp): boolean {
    return regex.test(value);
  }

  static ethereumAddress(value: string): boolean {
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    return addressRegex.test(value);
  }

  static positiveNumber(value: number): boolean {
    return typeof value === 'number' && value > 0;
  }

  static dateInFuture(value: string | Date): boolean {
    const date = new Date(value);
    return date > new Date();
  }

  static dateRange(startDate: string | Date, endDate: string | Date): boolean {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return start < end;
  }
}

export class FormValidator {
  private schema: FormValidationSchema;
  private errors: Record<string, string[]> = {};

  constructor(schema: FormValidationSchema) {
    this.schema = schema;
  }

  validate(data: Record<string, any>): ValidationResult {
    this.errors = {};
    let isValid = true;

    for (const [fieldName, validation] of Object.entries(this.schema)) {
      const value = data[fieldName];
      const fieldErrors = this.validateField(value, validation, fieldName);
      
      if (fieldErrors.length > 0) {
        this.errors[fieldName] = fieldErrors;
        isValid = false;
      }
    }

    return {
      isValid,
      errors: this.getAllErrors(),
    };
  }

  private validateField(value: any, validation: FieldValidation, fieldName: string): string[] {
    const errors: string[] = [];

    if (validation.required && !Validator.required(value)) {
      errors.push(`${fieldName} is required`);
      return errors; // Don't validate further if required field is empty
    }

    if (value && validation.minLength && typeof value === 'string') {
      if (!Validator.minLength(value, validation.minLength)) {
        errors.push(`${fieldName} must be at least ${validation.minLength} characters`);
      }
    }

    if (value && validation.maxLength && typeof value === 'string') {
      if (!Validator.maxLength(value, validation.maxLength)) {
        errors.push(`${fieldName} must be no more than ${validation.maxLength} characters`);
      }
    }

    if (value && validation.pattern && typeof value === 'string') {
      if (!Validator.pattern(value, validation.pattern)) {
        errors.push(`${fieldName} format is invalid`);
      }
    }

    if (value && validation.custom) {
      const customResult = validation.custom(value);
      if (typeof customResult === 'string') {
        errors.push(customResult);
      } else if (!customResult) {
        errors.push(`${fieldName} is invalid`);
      }
    }

    return errors;
  }

  private getAllErrors(): string[] {
    return Object.values(this.errors).flat();
  }

  getFieldErrors(fieldName: string): string[] {
    return this.errors[fieldName] || [];
  }

  hasFieldError(fieldName: string): boolean {
    return this.getFieldErrors(fieldName).length > 0;
  }
}

// Pre-defined validation schemas
export const ValidationSchemas = {
  login: {
    voterId: {
      required: true,
      minLength: 3,
      maxLength: 50,
      pattern: /^[a-zA-Z0-9_]+$/,
    },
    password: {
      required: true,
      minLength: 6,
    },
  },

  election: {
    name: {
      required: true,
      minLength: 3,
      maxLength: 100,
    },
    startDate: {
      required: true,
      custom: (value: string) => {
        if (!Validator.dateInFuture(value)) {
          return 'Start date must be in the future';
        }
        return true;
      },
    },
    endDate: {
      required: true,
      custom: (value: string) => {
        if (!Validator.dateInFuture(value)) {
          return 'End date must be in the future';
        }
        return true;
      },
    },
  },

  candidate: {
    name: {
      required: true,
      minLength: 2,
      maxLength: 50,
      pattern: /^[a-zA-Z\s]+$/,
    },
    party: {
      required: true,
      minLength: 2,
      maxLength: 50,
    },
  },

  wallet: {
    address: {
      required: true,
      custom: (value: string) => {
        if (!Validator.ethereumAddress(value)) {
          return 'Invalid Ethereum address format';
        }
        return true;
      },
    },
  },
} as const;

// Real-time validation for form inputs
export class RealTimeValidator {
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    document.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      if (target.dataset.validate) {
        this.validateField(target);
      }
    });

    document.addEventListener('blur', (event) => {
      const target = event.target as HTMLInputElement;
      if (target.dataset.validate) {
        this.validateField(target, false); // No debounce on blur
      }
    });
  }

  private validateField(input: HTMLInputElement, debounce = true): void {
    const fieldName = input.name || input.id;
    const schemaName = input.dataset.validate;
    
    if (!schemaName || !fieldName) return;

    const validateFn = () => {
      const schema = ValidationSchemas[schemaName as keyof typeof ValidationSchemas];
      if (!schema) return;

      const validator = new FormValidator({ [fieldName]: schema[fieldName as keyof typeof schema] });
      const result = validator.validate({ [fieldName]: input.value });

      this.updateFieldUI(input, result.isValid, validator.getFieldErrors(fieldName));
    };

    if (debounce) {
      const existingTimer = this.debounceTimers.get(fieldName);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(validateFn, 300);
      this.debounceTimers.set(fieldName, timer);
    } else {
      validateFn();
    }
  }

  private updateFieldUI(input: HTMLInputElement, isValid: boolean, errors: string[]): void {
    // Remove existing validation classes
    input.classList.remove('valid', 'invalid');
    
    // Add appropriate class
    input.classList.add(isValid ? 'valid' : 'invalid');

    // Update error message
    const errorElement = document.querySelector(`[data-error-for="${input.name || input.id}"]`);
    if (errorElement) {
      errorElement.textContent = errors[0] || '';
      errorElement.classList.toggle('hidden', isValid);
    }

    // Update parent container if it has validation classes
    const container = input.closest('.input-group, .form-field');
    if (container) {
      container.classList.remove('has-error', 'has-success');
      container.classList.add(isValid ? 'has-success' : 'has-error');
    }
  }

  validateForm(formElement: HTMLFormElement): ValidationResult {
    const formData = new FormData(formElement);
    const data: Record<string, any> = {};
    
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }

    // Get schema from form's data attribute
    const schemaName = formElement.dataset.validate;
    if (!schemaName) {
      return { isValid: true, errors: [] };
    }

    const schema = ValidationSchemas[schemaName as keyof typeof ValidationSchemas];
    if (!schema) {
      return { isValid: true, errors: [] };
    }

    const validator = new FormValidator(schema);
    const result = validator.validate(data);

    // Update UI for all fields
    const inputs = formElement.querySelectorAll('input[name], select[name], textarea[name]');
    inputs.forEach((input) => {
      const fieldName = (input as HTMLInputElement).name;
      const fieldErrors = validator.getFieldErrors(fieldName);
      this.updateFieldUI(input as HTMLInputElement, fieldErrors.length === 0, fieldErrors);
    });

    return result;
  }
}

// Sanitization utilities
export class Sanitizer {
  static html(input: string): string {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  static sql(input: string): string {
    return input.replace(/['";\\]/g, '\\$&');
  }

  static filename(input: string): string {
    return input.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  static alphanumeric(input: string): string {
    return input.replace(/[^a-zA-Z0-9]/g, '');
  }

  static trim(input: string): string {
    return input.trim();
  }

  static toLowerCase(input: string): string {
    return input.toLowerCase();
  }

  static removeExtraSpaces(input: string): string {
    return input.replace(/\s+/g, ' ').trim();
  }
}

// Initialize real-time validation
export const realTimeValidator = new RealTimeValidator();
