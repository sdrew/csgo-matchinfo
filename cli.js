#!/usr/bin/env node

import meow from 'meow';
import CSGOMatchInfo from './index.js';

const cliopts = meow(
  `
  Usage
    $ csgo-matchinfo <opts> match <match share code>
    $ csgo-matchinfo <opts> profile <steam id>

  Options
    --credentials, -c     Credentials file
    --debug,       -d     Display additional debug information
    --env,         -e     Use ENV for Credentials
    --full,        -f     Output full match info to file
    --json,        -j     JSON output
    --sentry,      -t     Sentry file
    --servers,     -s     Servers file
`,
  {
    importMeta: import.meta,
    flags: {
      credentials: {
        type: 'string',
        alias: 'c',
      },
      debug: {
        type: 'boolean',
        alias: 'd',
        default: false,
      },
      env: {
        type: 'boolean',
        alias: 'e',
        default: false,
      },
      full: {
        type: 'boolean',
        alias: 'f',
        default: false,
      },
      json: {
        type: 'boolean',
        alias: 'j',
        default: false,
      },
      sentry: {
        type: 'string',
        alias: 't',
      },
      servers: {
        type: 'string',
        alias: 's',
      },
    },
    autoHelp: true,
  }
);

var action = cliopts.input[0];
if (['match', 'profile'].indexOf(action) < 0) {
  cliopts.showHelp(1);
}

var codes = cliopts.input[1];
codes = codes.split(' ');
if (codes.length < 1) {
  cliopts.showHelp(2);
}

var cli = new CSGOMatchInfo({
  debug: cliopts.flags.debug,
  env: cliopts.flags.env,
  full: cliopts.flags.full,
  json: cliopts.flags.json,
});

if (!cli.serversFileSet(cliopts.flags.servers)) {
  cliopts.showHelp(4);
}

cli.credentialsFileSet(cliopts.flags.credentials);
cli.sentryFileSet(cliopts.flags.sentry);

if (!cli.credentialsLoad()) {
  cliopts.showHelp(5);
}
if (!cli.credentialsValid()) {
  cliopts.showHelp(6);
}

if (!cli.fetchInfo(action, codes)) {
  cliopts.showHelp(7);
}
