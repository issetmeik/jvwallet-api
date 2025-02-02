import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Req,
  Body,
} from '@nestjs/common';
import { BaseHttpResponse } from 'src/common/base-http-response';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { CreateDto, SendTransactionDto } from 'src/common/interfaces';
import { WalletService } from 'src/services/wallet.service';

@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createWallet(@Req() request, @Body() createDto: CreateDto) {
    const userId: string = request.user.id;
    const wallet = await this.walletService.createWallet(
      userId,
      createDto.name,
    );

    const response = BaseHttpResponse.success(wallet);
    return response;
  }

  @Post('sync/:walletId')
  @UseGuards(JwtAuthGuard)
  async syncWallet(@Param('walletId') walletId: string) {
    await this.walletService.enqueueWalletSync(walletId);
    return BaseHttpResponse.success({
      message: `Wallet ${walletId} added to sync queue`,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserWallets(@Req() request) {
    const userId: string = request.user.id;
    const wallets = await this.walletService.findUserWallets(userId);
    return BaseHttpResponse.success(wallets);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getWallet(@Param('id') id: string) {
    const response = await this.walletService.getWalletById(id);
    const { privateKey, ...walletWithoutPrivateKey } = response;
    return BaseHttpResponse.success(walletWithoutPrivateKey);
  }

  @Post('send-transaction/:walletId')
  @UseGuards(JwtAuthGuard)
  async sendTransaction(
    @Req() request,
    @Param('walletId') walletId: string,
    @Body() sendTransactionDto: SendTransactionDto,
  ) {
    const userId: string = request.user.id;
    const { toAddress, amountSatoshis, password } = sendTransactionDto;

    const transaction = await this.walletService.sendTransaction(
      userId,
      walletId,
      toAddress,
      amountSatoshis,
      password,
    );

    return BaseHttpResponse.success(transaction);
  }
}
