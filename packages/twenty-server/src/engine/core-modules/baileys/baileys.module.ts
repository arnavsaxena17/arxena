import { Module } from '@nestjs/common';
import { BaileysController } from './baileys.controller';
import { BaileysService } from './baileys.service';
import { SocketGateway } from './socket-gateway/socket.gateway';
import { ConfigModule } from '@nestjs/config';

@Module( {
    imports: [ ],
    controllers: [ BaileysController ],
    providers: [ BaileysService, SocketGateway ],
} )
export class BaileysModule {}