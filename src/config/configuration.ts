import { validateEnv, AppConfig } from './config.schema';

export default (): AppConfig => validateEnv(process.env);
export type { AppConfig };
