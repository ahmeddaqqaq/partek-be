import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService(10);

  it('produces a hash that is not the plaintext', async () => {
    const hash = await service.hash('correct-horse');
    expect(hash).not.toBe('correct-horse');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('produces a different hash each call for the same input', async () => {
    const [a, b] = await Promise.all([
      service.hash('correct-horse'),
      service.hash('correct-horse'),
    ]);
    expect(a).not.toBe(b);
  });

  it('verifies a correct password', async () => {
    const hash = await service.hash('correct-horse');
    await expect(service.compare('correct-horse', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('correct-horse');
    await expect(service.compare('wrong-horse', hash)).resolves.toBe(false);
  });
});
