import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { LoginDto, Token } from 'src/common/interfaces';
import { UserService } from 'src/services/user.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(loginDto: LoginDto): Promise<User> {
    const user = await this.userService.findByLogin(loginDto.login);

    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      throw new HttpException('Invalid credentials.', HttpStatus.UNAUTHORIZED);
    }

    return user;
  }

  generateToken(user: User): Token {
    const payload = { id: user.id, login: user.login };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  verifyToken(token: string): Promise<any> {
    return this.jwtService.verify(token);
  }
}
