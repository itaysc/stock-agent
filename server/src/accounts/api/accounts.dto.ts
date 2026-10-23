import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AddAccountDto {
  @ApiProperty({ example: 'Paper 2' })
  @IsString()
  @MaxLength(60)
  name: string;

  @ApiProperty({ description: "The paper key's ID (starts with PK)" })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  keyId: string;

  @ApiProperty({ description: "The key's secret" })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  secret: string;
}

export class RenameAccountDto {
  @ApiProperty({ example: 'Paper 2' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;
}
