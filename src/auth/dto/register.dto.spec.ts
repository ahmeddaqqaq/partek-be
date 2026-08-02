import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  it('passes with valid email and password', async () => {
    const dto = plainToInstance(RegisterDto, { email: 'user@example.com', password: 'pass123' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails with invalid email', async () => {
    const dto = plainToInstance(RegisterDto, { email: 'not-an-email', password: 'pass123' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('fails with password shorter than 6 characters', async () => {
    const dto = plainToInstance(RegisterDto, { email: 'user@example.com', password: '123' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});
