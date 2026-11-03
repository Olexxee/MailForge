import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRootEnv = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../.env');
config({ path: process.env.DOTENV_CONFIG_PATH ?? projectRootEnv });
