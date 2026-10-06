const fs = require('node:fs');
const path = require('node:path');

function loadEvents(client, rootDir) {
  if (!fs.existsSync(rootDir)) return;
  for (const file of fs
    .readdirSync(rootDir)
    .filter((name) => name.endsWith('.js'))) {
    const event = require(path.join(rootDir, file));
    if (event.name && typeof event.execute === 'function') {
      client[event.once ? 'once' : 'on'](event.name, (...args) =>
        event.execute(...args, client),
      );
    }
  }
}

module.exports = { loadEvents };
