const fs = require('node:fs');
const path = require('node:path');

function loadCommands(rootDir) {
  const commands = new Map();
  const walk = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.name.endsWith('.js')) {
        const command = require(fullPath);
        if (command.data?.name && typeof command.execute === 'function') commands.set(command.data.name, command);
      }
    }
  };
  walk(rootDir);
  return commands;
}

module.exports = { loadCommands };
