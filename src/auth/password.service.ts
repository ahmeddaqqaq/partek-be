import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

export const BCRYPT_ROUNDS = 'BCRYPT_ROUNDS';

@Injectable()
export class PasswordService {
  constructor(@Inject(BCRYPT_ROUNDS) private readonly rounds: number) {}

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
