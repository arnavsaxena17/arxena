// Mock lingui macro for tsx/ts-node execution
// This is needed because lingui macros require build-time transformation
// Patch the module system before any lingui imports

const mockMsg = (strings: TemplateStringsArray, ...values: any[]) => {
  const message = strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '');
  return { message, id: message };
};

// Patch CommonJS require
if (typeof require !== 'undefined') {
  try {
    const Module = require('module');
    const originalRequire = Module.prototype.require;
    Module.prototype.require = function (id: string) {
      if (id === '@lingui/core/macro' || id === '@lingui/react/macro') {
        return { msg: mockMsg, t: mockMsg, Trans: mockMsg };
      }
      return originalRequire.apply(this, arguments as any);
    };
    
    // Also cache the mock in module cache
    // @ts-ignore
    Module._cache['@lingui/core/macro'] = {
      exports: { msg: mockMsg, t: mockMsg, Trans: mockMsg },
      loaded: true,
    };
  } catch (e) {
    // Ignore errors
  }
}

// Export for potential ES module usage
export { mockMsg as msg };

