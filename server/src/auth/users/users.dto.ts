import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { MIN_PASSWORD } from './users.service.js';

export class SignUpDto {
  @ApiProperty({ description: 'The token from the invite link' })
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token: string;

  @ApiProperty({ example: 'you@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(MIN_PASSWORD)
  @MaxLength(200)
  password: string;
}

export class InviteDto {
  @ApiProperty({
    example: 'Dana',
    description: 'Who it is for (a note for you)',
  })
  @IsString()
  @MaxLength(60)
  note: string;
}
