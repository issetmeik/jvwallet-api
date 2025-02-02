import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { User } from '@prisma/client';
import { hash, compare } from 'bcrypt';
import { UserRepository } from 'src/repositories/user.repository';
import { UserDto } from 'src/common/interfaces';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async create(dto: UserDto): Promise<User> {
    const existingUser = await this.userRepository.findByLogin(dto.login);

    if (existingUser) {
      throw new HttpException(
        'Já existe um usuário com esse login.',
        HttpStatus.CONFLICT,
      );
    }

    const hashedPassword = await hash(dto.password, 10);

    return this.userRepository.create({
      ...dto,
      password: hashedPassword,
    });
  }

  async validatePassword(id: string, password: string): Promise<boolean> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new HttpException('Usuário não encontrado.', HttpStatus.NOT_FOUND);
    }

    const isMatch = await compare(password, user.password);

    if (!isMatch) {
      throw new HttpException('Senha inválida.', HttpStatus.NOT_ACCEPTABLE);
    }

    return true;
  }

  findByLogin(login: string): Promise<User | null> {
    return this.userRepository.findByLogin(login);
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }
}
