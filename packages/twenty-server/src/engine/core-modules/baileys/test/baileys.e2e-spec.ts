// import { Test, TestingModule } from '@nestjs/testing';
// import { INestApplication } from '@nestjs/common';
// import request from 'supertest';
// import { BaileysModule } from '../baileys.module';

// describe('BaileysController (e2e)', () => {
//   let baileys: INestApplication;

//   beforeEach(async () => {
//     const moduleFixture: TestingModule = await Test.createTestingModule({
//       imports: [BaileysModule],
//     }).compile();

//     baileys = moduleFixture.createNestApplication();
//     await baileys.init();
//   });

//   it('/ (GET)', () => {
//     return request(baileys.getHttpServer())
//       .get('/')
//       .expect(200)
//       .expect('Hello World!');
//   });
// });
