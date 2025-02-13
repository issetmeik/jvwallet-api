import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Transaction, Wallet } from '@prisma/client';
import { CreateWalletDto } from 'src/common/interfaces';

type WalletWithTransactions = Wallet & { transactions: Transaction[] };

@Injectable()
export class WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    createWalletDto: CreateWalletDto,
  ): Promise<Omit<Wallet, 'privateKey'>> {
    const { userId, address, privateKey, name } = createWalletDto;

    return this.prisma.wallet.create({
      data: {
        userId,
        address,
        privateKey,
        name,
      },
      select: {
        id: true,
        userId: true,
        address: true,
        balance: true,
        createdAt: true,
        name: true,
        transactions: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  findWalletById(walletId: string): Promise<WalletWithTransactions | null> {
    return this.prisma.wallet.findUnique({
      where: { id: walletId },
      include: {
        transactions: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  updateBalance(walletId: string, balance: number): Promise<Wallet> {
    return this.prisma.wallet.update({
      where: { id: walletId },
      data: { balance },
    });
  }

  findWalletsByUserId(userId): Promise<Omit<Wallet, 'privateKey'>[]> {
    return this.prisma.wallet.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        address: true,
        balance: true,
        createdAt: true,
        name: true,
        transactions: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  findWalletByAddress(address: string): Promise<Wallet | null> {
    return this.prisma.wallet.findUnique({
      where: { address },
    });
  }
}
