import { Injectable } from '@nestjs/common';

console.log("BaileysService being called!!!")
@Injectable()
export class BaileysService {
  getHello(): string {
    console.log("BaileysService being calledW!!!")
    return 'Hello World!';
  }
}
