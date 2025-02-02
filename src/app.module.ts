import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from 'src/app.controller';
import { AppService } from 'src/app.service';
import { TransactionRepository } from 'src/repositories/transaction.repository';
import { PrismaService } from 'prisma/prisma.service';
import { WalletController } from 'src/controllers/wallet.controller';
import { WalletService } from 'src/services/wallet.service';
import { WalletRepository } from 'src/repositories/wallet.repository';
import { UserController } from 'src/controllers/user.controller';
import { UserService } from 'src/services/user.service';
import { UserRepository } from 'src/repositories/user.repository';
import { AuthController } from 'src/controllers/auth.controller';
import { AuthService } from 'src/services/auth.service';
import { WalletSyncWorker } from 'src/workers/wallet-sync.worker';
import { BlockstreamService } from 'src/services/blockstream.service';
import { TransactionService } from 'src/services/transaction.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: process.env.JWT_EXPIRES_IN },
      }),
    }),
  ],
  controllers: [
    AppController,
    WalletController,
    UserController,
    AuthController,
  ],
  providers: [
    AppService,
    PrismaService,
    TransactionRepository,
    WalletService,
    WalletRepository,
    UserService,
    UserRepository,
    AuthService,
    WalletSyncWorker,
    BlockstreamService,
    TransactionService,
  ],
  exports: [],
})
export class AppModule {}
