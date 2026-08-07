import { validateEnv } from '@ecoswift/config';

export function validate(config: Record<string, unknown>) {
  return validateEnv(config);
}
