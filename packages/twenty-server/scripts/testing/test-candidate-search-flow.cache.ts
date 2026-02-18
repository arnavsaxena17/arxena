import * as fs from 'fs';
import * as path from 'path';
import { CACHE_DIR } from './test-candidate-search-flow.config';

export function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

export function getCacheFilePath(index: number, step: string): string {
  return path.join(CACHE_DIR, `query-${index}-${step}.json`);
}

export function readCache<T>(filePath: string): T | null {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch (error) {
    console.log(
      `Warning: Failed to read cache file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
  return null;
}

export function writeCache<T>(filePath: string, data: T): void {
  try {
    ensureCacheDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.log(
      `Warning: Failed to write cache file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
