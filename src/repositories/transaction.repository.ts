import { Injectable } from '@nestjs/common';
import { Transaction, Status } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class TransactionRepository {
  constructor(private readonly db: PrismaService) {}

  createTransaction(
    walletId: string,
    txid: string,
    amount: number,
    direction: 'IN' | 'OUT',
  ): Promise<Transaction> {
    return this.db.transaction.create({
      data: { walletId, txid, amount, direction, status: 'PENDING' },
    });
  }

  updateTransactionStatus(
    txid: string,
    walletId,
    status: 'CONFIRMED' | 'FAILED',
  ): Promise<Transaction> {
    return this.db.transaction.update({
      where: { walletId_txid: { walletId, txid } },
      data: { status },
    });
  }

  findTransactionsByWalletId(walletId: string): Promise<Transaction[]> {
    return this.db.transaction.findMany({
      where: { walletId },
    });
  }

  findWalletTransactionsByStatus(
    walletId: string,
    status: Status,
  ): Promise<Transaction[]> {
    return this.db.transaction.findMany({
      where: { walletId, status },
    });
  }
}
