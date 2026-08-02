import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  it('passes with valid email and password', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'user@example.com',
      password: 'password123',
      role: 'client',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails with invalid email', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'not-an-email',
      password: 'password123',
      role: 'client',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('fails with password shorter than 8 characters', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'user@example.com',
      password: 'pass123',
      role: 'client',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('fails when role is missing', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'user@example.com',
      password: 'password123',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });

  it('rejects a phone number that is not a Saudi mobile', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'user@example.com',
      password: 'password123',
      role: 'client',
      phone: '+14155550123',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('accepts a Saudi mobile number', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'user@example.com',
      password: 'password123',
      role: 'client',
      phone: '+966501234567',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
