import { type ToolProgressData } from 'twenty-shared/ai';

export type ToolProgressStreamEmitter = (data: ToolProgressData) => void;
