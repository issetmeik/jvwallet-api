import { Body, Controller, Post } from '@nestjs/common';
import { UserService } from 'src/services/user.service';
import { BaseHttpResponse } from 'src/common/base-http-response';
import { UserDto } from 'src/common/interfaces';

@Controller('users')
export class UserController {
  constructor(private readonly service: UserService) {}

  @Post('/')
  async store(@Body() createUserDto: UserDto) {
    const user = await this.service.create(createUserDto);
    const response = BaseHttpResponse.success(user, 201);
    return response;
  }
}
