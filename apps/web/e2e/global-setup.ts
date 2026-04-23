import { execSync } from 'child_process';
import path from 'path';

export default async function globalSetup() {
  const apiDir = path.resolve(__dirname, '../../api');

  execSync('node --import tsx src/e2e-seed.ts', {
    cwd: apiDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://financiero:financiero_test@localhost:5435/financiero_test?schema=public',
    },
  });
}
