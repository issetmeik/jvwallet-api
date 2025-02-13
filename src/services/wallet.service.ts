import { UserService } from 'src/services/user.service';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { TransactionRepository } from 'src/repositories/transaction.repository';
import { WalletRepository } from 'src/repositories/wallet.repository';
import { PrivateKey, Networks, Address, Transaction } from 'bitcore-lib';
import { CreateWalletDto } from 'src/common/interfaces';
import { Wallet } from '@prisma/client';
import { KMSHelper } from 'src/utils/aws-kms.helper';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Network, validate } from 'bitcoin-address-validation';
import { BlockstreamService } from 'src/services/blockstream.service';

@Injectable()
export class WalletService {
  private network: Networks.Network;
  private readonly logger = new Logger(WalletService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl = process.env.SQS_QUEUE_URL;

  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly userService: UserService,
    private readonly blockstreamService: BlockstreamService,
  ) {
    this.network =
      process.env.BITCOIN_NETWORK === 'mainnet'
        ? Networks.mainnet
        : Networks.testnet;
    this.sqsClient = new SQSClient({ region: process.env.AWS_REGION });
  }

  async createWallet(
    userId: string,
    name,
  ): Promise<Omit<Wallet, 'privateKey'>> {
    const user = await this.userService.findById(userId);

    if (!user) {
      throw new HttpException('User not found!', HttpStatus.NOT_FOUND);
    }

    const { privateKey, address } = this.generatePrivateKeyAndAddress();

    const encryptedPrivateKey = await KMSHelper.encrypt(privateKey);

    const createWalletDto: CreateWalletDto = {
      userId,
      address,
      name,
      privateKey: encryptedPrivateKey,
    };

    return this.walletRepository.create(createWalletDto);
  }

  async findUserWallets(userId: string): Promise<Omit<Wallet, 'privateKey'>[]> {
    const user = await this.userService.findById(userId);

    if (!user) {
      throw new HttpException('User not found!', HttpStatus.NOT_FOUND);
    }

    return await this.walletRepository.findWalletsByUserId(userId);
  }

  async getWalletById(walletId: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findWalletById(walletId);
    if (!wallet)
      throw new HttpException('Wallet not found.', HttpStatus.NOT_FOUND);
    return wallet;
  }

  getTransactionsByWalletId(walletId: string) {
    return this.transactionRepository.findTransactionsByWalletId(walletId);
  }

  async updateWalletBalance(walletId: string, newBalance: number) {
    return this.walletRepository.updateBalance(walletId, newBalance);
  }

  generatePrivateKeyAndAddress() {
    const privateKey = new PrivateKey(undefined, this.network);
    const address: Address = privateKey.toAddress();

    return {
      privateKey: privateKey.toString(),
      address: address.toString(),
    };
  }

  async enqueueWalletSync(walletId: string) {
    this.logger.log(`Adding wallet: ${walletId} to SQS queue`);

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify({ walletId }),
    });

    await this.sqsClient.send(command);
    this.logger.log(`Wallet: ${walletId} added to queue`);
  }

  async validateWalletOwnership(
    walletId: string,
    userId: string,
  ): Promise<void> {
    const wallet = await this.walletRepository.findWalletById(walletId);
    if (!wallet) {
      throw new HttpException('Wallet not found!', HttpStatus.NOT_FOUND);
    }

    if (wallet.userId !== userId) {
      throw new HttpException(
        'You do not have permission to access this wallet.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async sendTransaction(
    userId: string,
    walletId: string,
    toAddress: string,
    amountSatoshis: number,
    password: string,
  ) {
    await this.userService.validatePassword(userId, password);
    await this.validateWalletOwnership(walletId, userId);

    const wallet = await this.getWalletById(walletId);

    if (!validate(toAddress, this.network.name as Network)) {
      throw new HttpException(
        'Bitcoin address invalid.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const privateKeyStr = await KMSHelper.decrypt(wallet.privateKey);
    const privateKey = new PrivateKey(privateKeyStr, this.network);

    const utxos = await this.blockstreamService.getFormattedUtxos(
      wallet.address,
    );

    if (!utxos || utxos.length === 0) {
      throw new HttpException('No available funds.', HttpStatus.BAD_REQUEST);
    }

    const inputs = utxos.length;
    const outputs = 2;
    const fee = await this.calculateTransactionFee(inputs, outputs);

    const totalAvailable = utxos.reduce((sum, utxo) => sum + utxo.satoshis, 0);

    const changeAmount = totalAvailable - (amountSatoshis + fee);

    if (changeAmount < 0) {
      throw new HttpException('Insufficiente Balance', HttpStatus.BAD_REQUEST);
    }

    const tx = new Transaction().from(utxos).to(toAddress, amountSatoshis);

    if (changeAmount > 0) {
      tx.change(wallet.address);
    }

    tx.fee(fee).sign(privateKey);

    const txId = await this.blockstreamService.broadcastTransaction(
      tx.serialize(),
    );

    await this.enqueueWalletSync(walletId);

    const toAddressWallet =
      await this.walletRepository.findWalletByAddress(toAddress);

    if (toAddressWallet) await this.enqueueWalletSync(toAddressWallet.id);

    this.logger.log(`Transaction sent: ${txId}`);

    return { txId };
  }

  async getEstimatedFee(): Promise<number> {
    const feeEstimates = await this.blockstreamService.getEstimateFee();

    return Math.min(...Object.values(feeEstimates));
  }

  async calculateTransactionFee(
    inputs: number,
    outputs: number,
  ): Promise<number> {
    const feeRate = await this.getEstimatedFee();
    const estimatedSize = 10 + inputs * 180 + outputs * 34;
    return Math.ceil(feeRate * estimatedSize);
  }
}
