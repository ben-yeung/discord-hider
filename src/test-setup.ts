import '@testing-library/jest-dom'
import { vi } from 'vitest'

Object.defineProperty(globalThis, 'chrome', {
  value: {
    storage: {
      sync: {
        get: vi.fn(),
        set: vi.fn(),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    runtime: {
      onMessage: {
        addListener: vi.fn(),
      },
      openOptionsPage: vi.fn(),
    },
    tabs: {
      query: vi.fn(),
      sendMessage: vi.fn(),
    },
  },
  writable: true,
})
