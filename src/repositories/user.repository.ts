import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { User } from '@prisma/client';
import { UserDto } from 'src/common/interfaces';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: UserDto): Promise<User> {
    return this.prisma.user.create({
      data: {
        login: dto.login,
        password: dto.password,
      },
    });
  }

  findByLogin(login: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { login },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id } });
  }
}
