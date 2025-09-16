// Tests for AuthManager module
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthManager } from '../../js/modules/auth.js';

describe('AuthManager', () => {
  let authManager: AuthManager;

  beforeEach(() => {
    localStorage.clear();
    // Mock fetch for API calls
    global.fetch = vi.fn() as any;
    authManager = new AuthManager();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          token: 'mock-token',
          role: 'admin'
        })
      };

      (global.fetch as any) = vi.fn().mockResolvedValue(mockResponse);

      const result = await authManager.login('admin1', 'admin123');

      expect(result.success).toBe(true);
      expect(result.user?.role).toBe('admin');
      expect(result.token).toBe('mock-token');
      expect(localStorage.setItem).toHaveBeenCalledWith('voting_token', 'mock-token');
    });

    it('should fail login with invalid credentials', async () => {
      const mockResponse = {
        ok: false,
        status: 401
      };
      
      (global.fetch as any).mockResolvedValue(mockResponse);
      
      await expect(authManager.login('invalid', 'invalid'))
        .rejects.toThrow('Login failed');
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when token exists', () => {
      localStorage.setItem('voting_token', 'mock-token');
      authManager = new AuthManager();
      
      expect(authManager.isAuthenticated()).toBe(true);
    });

    it('should return false when no token exists', () => {
      expect(authManager.isAuthenticated()).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear token and user data', () => {
      localStorage.setItem('voting_token', 'mock-token');
      localStorage.setItem('voting_user', JSON.stringify({ id: 'test', role: 'admin' }));
      
      authManager.logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith('voting_token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('voting_user');
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin user', () => {
      localStorage.setItem('voting_user', JSON.stringify({ id: 'test', role: 'admin' }));
      authManager = new AuthManager();
      
      expect(authManager.isAdmin()).toBe(true);
    });

    it('should return false for voter user', () => {
      localStorage.setItem('voting_user', JSON.stringify({ id: 'test', role: 'voter' }));
      authManager = new AuthManager();
      
      expect(authManager.isAdmin()).toBe(false);
    });
  });
});
