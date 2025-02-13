import { Injectable } from '@nestjs/common';
import { Status, Transaction } from '@prisma/client';
import { TransactionRepository } from 'src/repositories/transaction.repository';

@Injectable()
export class TransactionService {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async createTransaction() {}

  getTransactionsByWalletId(walletId: string): Promise<Transaction[]> {
    return this.transactionRepository.findTransactionsByWalletId(walletId);
  }

  getWalletTransactionsByStatus(
    walletId: string,
    status: Status,
  ): Promise<Transaction[]> {
    return this.transactionRepository.findWalletTransactionsByStatus(
      walletId,
      status,
    );
  }
}
