import { IsString, IsUUID, IsNotEmpty, IsNumber, Min } from 'class-validator';

export interface IWalletData {
  privateKey: string;
  address: string;
}

export class CreateWalletDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsString()
  @IsNotEmpty()
  privateKey: string;
}

export class CreateDto {
  @IsNotEmpty()
  @IsString()
  name: string;
}

export class SendTransactionDto {
  @IsNotEmpty()
  @IsString()
  toAddress: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1000)
  amountSatoshis: number;

  @IsNotEmpty()
  password: string;
}
