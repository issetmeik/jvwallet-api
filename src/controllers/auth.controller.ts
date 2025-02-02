import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from 'src/services/auth.service';
import { BaseHttpResponse } from 'src/common/base-http-response';
import { LoginDto } from 'src/common/interfaces';

@Controller('session')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('')
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto);
    const token = this.authService.generateToken(user);
    const response = BaseHttpResponse.success(token);
    return response;
  }
}
