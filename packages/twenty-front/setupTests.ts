// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import React from 'react';

/**
 * The structuredClone global function is not available in jsdom, it needs to be mocked for now.
 *
 * The most naive way to mock structuredClone is to use JSON.stringify and JSON.parse. This works
 * for arguments with simple types like primitives, arrays and objects, but doesn't work with functions,
 * Map, Set, etc.
 */
global.structuredClone = (val) => {
  return JSON.parse(JSON.stringify(val));
};

// Some workspace packages assume React is available as a global (for JSX transforms).
// Expose it here so those modules work under Jest.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).React = React;

// Mock shiki, which is pulled in by prosemirror-highlight and currently shipped as ESM.
// Jest's Node-based runtime doesn't handle its ESM bundle in this repo's config,
// so we replace it with a no-op mock for tests.
jest.mock('shiki', () => ({}));

// Blocknote pulls in shiki/highlighter configuration and is not needed for most UI tests.
// Mock both core and react layers to avoid executing their complex initialization code
// (which assumes a real highlighter and editor DOM).
jest.mock('@blocknote/core', () => ({}));
jest.mock('@blocknote/react', () => ({}));

// jsdom does not implement matchMedia; provide a minimal mock for code paths
// that rely on it (e.g., theme detection).
if (!window.matchMedia) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query.includes('dark') ? false : true,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}
