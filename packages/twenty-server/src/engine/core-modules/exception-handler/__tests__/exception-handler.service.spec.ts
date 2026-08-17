import { Test, type TestingModule } from '@nestjs/testing';

import { EXCEPTION_HANDLER_DRIVER } from 'src/engine/core-modules/exception-handler/exception-handler.constants';
import { ExceptionHandlerService } from 'src/engine/core-modules/exception-handler/exception-handler.service';

describe('ExceptionHandlerService', () => {
  let service: ExceptionHandlerService;
  const captureExceptions = jest.fn();

  beforeEach(async () => {
    captureExceptions.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExceptionHandlerService,
        {
          provide: EXCEPTION_HANDLER_DRIVER,
          useValue: { captureExceptions },
        },
      ],
    }).compile();

    service = module.get<ExceptionHandlerService>(ExceptionHandlerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should swallow driver failures so reporting cannot crash the process', () => {
    captureExceptions.mockImplementation(() => {
      throw new TypeError('(exception.path ?? []).map is not a function');
    });

    expect(service.captureExceptions([new Error('boom')])).toEqual([]);
  });
});
