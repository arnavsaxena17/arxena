
export class Semaphore {
  private permits: number;
  private tasks: (() => void)[] = [];
  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    return new Promise(resolve => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.tasks.push(resolve);
      }
    });
  }

  release(): void {
    this.permits++;
    if (this.tasks.length > 0 && this.permits > 0) {
      this.permits--;
      const nextTask = this.tasks.shift();
      nextTask?.();
    }
  }
}
