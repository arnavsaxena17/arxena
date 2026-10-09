/* @license Enterprise */

export enum MeteredLlmExceptionCode {
  UNPRICED_MODEL = 'UNPRICED_MODEL',
  MISSING_TRANSCRIPTION_DURATION = 'MISSING_TRANSCRIPTION_DURATION',
}

export class MeteredLlmException extends Error {
  constructor(
    message: string,
    public readonly code: MeteredLlmExceptionCode,
  ) {
    super(message);
    this.name = 'MeteredLlmException';
  }
}
