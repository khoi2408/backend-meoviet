import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private readonly saltRounds: number;

  constructor() {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
    this.saltRounds = isNaN(rounds) ? 10 : rounds;
  }

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
