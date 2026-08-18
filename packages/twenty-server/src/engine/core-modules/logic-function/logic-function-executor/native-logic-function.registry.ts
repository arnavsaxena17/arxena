import { Injectable } from '@nestjs/common';

import { NativeLogicFunctionHandler } from 'src/engine/core-modules/logic-function/logic-function-executor/native-logic-function-handler.interface';

@Injectable()
export class NativeLogicFunctionRegistry {
  private readonly handlers: NativeLogicFunctionHandler[] = [];

  register(handler: NativeLogicFunctionHandler): void {
    this.handlers.push(handler);
  }

  find(name: string): NativeLogicFunctionHandler | undefined {
    return this.handlers.find((handler) => handler.isNative(name));
  }
}
