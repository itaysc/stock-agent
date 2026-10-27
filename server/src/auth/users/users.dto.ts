import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
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

  @ApiProperty({
    description:
      'Accepts the Terms of Use and the Privacy Policy (must be true)',
  })
  @Equals(true, {
    message: 'Please accept the Terms of Use and the Privacy Policy',
  })
  acceptTerms: boolean;
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
