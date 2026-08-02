import { Injectable } from '@nestjs/common';
import { Language, User, UserRole } from '@prisma-client';
import { PrismaService } from '@/database/prisma.service';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  phone?: string;
  role: UserRole;
  preferredLanguage?: Language;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createUser(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }
}
