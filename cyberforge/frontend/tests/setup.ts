import { vi } from 'vitest';
import '@testing-library/jest-dom';

// jsdom does not provide fetch. The API service uses fetch, so provide a
// minimal stub so components that probe the backend can render in tests.
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  ) as ReturnType<typeof vi.fn>;
}

export { expect };

beforeEach(() => {
  // no-op hook kept explicit for future global matchers/setup
});
