require('dotenv').config();

const { validateEnvironment } = require('../utils/config');
const { deploySlashCommandsViaRest } = require('../handlers/commandDeployer');

async function deploy() {
  validateEnvironment();
  await deploySlashCommandsViaRest(process.argv[2]);
}

deploy().catch((error) => {
  console.error('Command deployment failed:', error.message);
  process.exitCode = 1;
});
