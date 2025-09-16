// Test setup file for Vitest
import { vi, beforeEach } from 'vitest';

// Mock Web3 and Ethereum provider
const mockEthereum = {
  request: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  isMetaMask: true,
};

const mockWeb3 = {
  eth: {
    getAccounts: vi.fn().mockResolvedValue(['0x1234567890123456789012345678901234567890']),
    getBalance: vi.fn().mockResolvedValue('1000000000000000000'),
    getBlockNumber: vi.fn().mockResolvedValue(12345),
    net: {
      getId: vi.fn().mockResolvedValue(1337),
    },
  },
  utils: {
    fromWei: vi.fn((value) => (parseInt(value) / 1e18).toString()),
    toWei: vi.fn((value) => (parseFloat(value) * 1e18).toString()),
  },
};

// Setup global mocks
Object.defineProperty(window, 'ethereum', {
  value: mockEthereum,
  writable: true,
});

Object.defineProperty(window, 'Web3', {
  value: vi.fn(() => mockWeb3),
  writable: true,
});

Object.defineProperty(window, 'location', {
  value: {
    hostname: 'localhost',
    href: 'http://localhost:3000'
  },
  writable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
console.warn = vi.fn();
console.error = vi.fn();

// Setup DOM environment
document.body.innerHTML = '';

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: vi.fn().mockReturnValue([])
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
}));

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  localStorageMock.getItem.mockReturnValue(null);
});
