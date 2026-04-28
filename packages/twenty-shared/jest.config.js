"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts_jest_1 = require("ts-jest");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tsConfig = require('./tsconfig.json');
const jestConfig = {
    displayName: 'twenty-ui',
    preset: '../../jest.preset.js',
    testEnvironment: 'jsdom',
    transformIgnorePatterns: ['../../node_modules/'],
    transform: {
        '^.+\\.[tj]sx?$': [
            '@swc/jest',
            {
                jsc: {
                    parser: { syntax: 'typescript', tsx: true },
                    transform: { react: { runtime: 'automatic' } },
                },
            },
        ],
    },
    moduleNameMapper: Object.assign({ '\\.(jpg|jpeg|png|gif|webp|svg|svg\\?react)$': '<rootDir>/__mocks__/imageMock.js' }, (0, ts_jest_1.pathsToModuleNameMapper)(tsConfig.compilerOptions.paths)),
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
    extensionsToTreatAsEsm: ['.ts', '.tsx'],
    coverageDirectory: './coverage',
    coverageThreshold: {
        global: {
            statements: 100,
            lines: 100,
            functions: 100,
        },
    },
};
exports.default = jestConfig;
//# sourceMappingURL=jest.config.js.map