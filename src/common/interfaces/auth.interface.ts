import { IsNotEmpty } from 'class-validator';
export class LoginDto {
  @IsNotEmpty()
  readonly login: string;

  @IsNotEmpty()
  readonly password: string;
}

export interface Token {
  accessToken: string;
}
