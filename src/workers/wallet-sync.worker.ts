/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import { PrismaService } from 'prisma/prisma.service';

import { WalletService } from 'src/services/wallet.service';
import { Direction, Status } from '@prisma/client';
import { BlockstreamService } from 'src/services/blockstream.service';
import {
  TransactionDetails,
  TransactionInput,
  TransactionOutput,
} from 'src/common/interfaces';
import { TransactionService } from 'src/services/transaction.service';

@Injectable()
export class WalletSyncWorker implements OnModuleInit {
  private readonly logger = new Logger(WalletSyncWorker.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl = process.env.SQS_QUEUE_URL;

  constructor(
    private prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
    private readonly blockstreamService: BlockstreamService,
  ) {
    this.sqsClient = new SQSClient({ region: process.env.AWS_REGION });
  }

  onModuleInit() {
    this.logger.log(
      'WalletSyncWorker initialized and listening for SQS messages...',
    );
    this.processQueue();
  }

  async processQueue() {
    while (true) {
      try {
        const command = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 5,
        });

        const response = await this.sqsClient.send(command);

        if (response.Messages && response.Messages.length > 0) {
          for (const message of response.Messages) {
            const { walletId } = JSON.parse(message.Body || '{}');

            if (walletId) {
              await this.syncWalletTransactions(walletId);
              await this.syncWalletBalance(walletId);
              await this.deleteMessage(message.ReceiptHandle!);
            }
          }
        }
      } catch (error) {
        this.logger.error(`Error processing SQS queue: ${error.message}`);
      }
    }
  }

  async syncWalletBalance(walletId: string) {
    this.logger.log(`Syncing balance for wallet: ${walletId}`);

    const transactions =
      await this.transactionService.getTransactionsByWalletId(walletId);

    if (!transactions) {
      this.logger.log(`No transactions to analyze.`);
      return;
    }

    const balance = transactions.reduce((total, tx) => total + tx.amount, 0);

    await this.walletService.updateWalletBalance(walletId, balance);

    this.logger.log(
      `Balance updated for wallet ${walletId}: ${balance} satoshis`,
    );
  }

  async syncWalletTransactions(walletId: string) {
    this.logger.log(`Syncing wallet: ${walletId} Transactions`);

    const wallet = await this.walletService.getWalletById(walletId);

    const existingTransactions =
      await this.transactionService.getWalletTransactionsByStatus(
        walletId,
        Status.CONFIRMED,
      );

    const transactions: TransactionDetails[] =
      await this.blockstreamService.getTransactions(wallet.address);

    const ignoredTransactions = new Set(
      existingTransactions.map((tx) => tx.txid),
    );

    const filteredTransactions = transactions.filter(
      (tx) => !ignoredTransactions.has(tx.txid),
    );

    if (filteredTransactions.length === 0) {
      this.logger.log(`No transactions to process for wallet: ${walletId}`);
      return;
    }

    const transactionsToSave: any[] = [];

    for (const tx of filteredTransactions) {
      const { txid, status, fee, vin, vout } = tx;
      const isConfirmed = status.confirmed;
      const confirmedAt = isConfirmed
        ? new Date(status.block_time * 1000)
        : null;

      const { sentAmount, receivedAmount } = this.calculateTransactionAmounts(
        wallet.address,
        vin,
        vout,
      );

      const balanceChange = receivedAmount - sentAmount;
      const direction: Direction = balanceChange > 0 ? 'IN' : 'OUT';

      const { fromAddress, toAddress } = this.determineTransactionAddresses(
        wallet.address,
        vin,
        vout,
        direction,
      );

      transactionsToSave.push(
        this.prisma.transaction.upsert({
          where: { walletId_txid: { walletId, txid } },
          update: {
            status: isConfirmed ? Status.CONFIRMED : Status.PENDING,
            confirmedAt,
            fee: fee || 0,
            amount: balanceChange,
            direction,
            fromAddress,
            toAddress,
          },
          create: {
            walletId,
            txid,
            amount: balanceChange,
            fee: fee || 0,
            direction,
            status: isConfirmed ? Status.CONFIRMED : Status.PENDING,
            confirmedAt,
            fromAddress,
            toAddress,
          },
        }),
      );
    }

    await this.prisma.$transaction(transactionsToSave);

    this.logger.log(
      `Processed: ${filteredTransactions.length} transactions for wallet: ${walletId}`,
    );
  }

  private calculateTransactionAmounts(
    walletAddress: string,
    vin: TransactionInput[],
    vout: TransactionOutput[],
  ) {
    let sentAmount = 0;
    let receivedAmount = 0;

    for (const input of vin) {
      if (input.prevout.scriptpubkey_address === walletAddress) {
        sentAmount += input.prevout.value;
      }
    }

    for (const output of vout) {
      if (output.scriptpubkey_address === walletAddress) {
        receivedAmount += output.value;
      }
    }

    return { sentAmount, receivedAmount };
  }

  determineTransactionAddresses(
    walletAddress: string,
    vin: TransactionInput[],
    vout: TransactionOutput[],
    direction: Direction,
  ): { fromAddress: string | null; toAddress: string | null } {
    if (direction === Direction.IN) {
      return {
        fromAddress:
          vin.length > 0 ? vin[0].prevout?.scriptpubkey_address || null : null,
        toAddress: walletAddress,
      };
    }
    return {
      fromAddress: walletAddress,
      toAddress: vout.length > 0 ? vout[0]?.scriptpubkey_address || null : null,
    };
  }

  async deleteMessage(receiptHandle: string) {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
    });

    await this.sqsClient.send(command);
    this.logger.log(`Message deleted from queue`);
  }
}
