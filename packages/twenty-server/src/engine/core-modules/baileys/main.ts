// import { NestFactory } from '@nestjs/core';
// import { BaileysModule } from './baileys.module';
// import { ValidationPipe } from '@nestjs/common';

// async function bootstrap () {
//     const app = await NestFactory.create( BaileysModule );

//     // enable validation globally
//     app.useGlobalPipes(
//         new ValidationPipe( {
//             whitelist: true,
//             transform: true,
//             stopAtFirstError: true
//         } ),
//     );

//     const PORT = process.env.PORT ?? 4000; // Provide a default value for PORT if it is undefined
//     await app.listen( PORT );
//     console.log( "========================================================" );
//     console.log( `       app is running on http://localhost:${ PORT }      ` );
//     console.log( "========================================================" );

// }
// bootstrap();
