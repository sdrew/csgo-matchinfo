import Steam from 'steam';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export default class CSGOMatchInfoUtils {
  debugLog(...args) {
    if (this._debug) {
      console.log(...args);
    }
  }

  errorLog(...args) {
    console.warn(...args);
  }

  outputLog(...args) {
    if (!this._json) {
      console.log(...args);
    }
  }

  credentialsLoad(credentials = null) {
    if (!credentials) {
      if (!this._credentials_file && !this._env_credentials) {
        this.errorLog('No credentials provided and no credentials file is set.');
        return false;
      }

      if (this._env_credentials) {
        credentials = {
          account_name: process.env.STEAM_ACCOUNT_NAME,
          password: process.env.STEAM_ACCOUNT_PASSWORD,
          auth_code: process.env.STEAM_ACCOUNT_AUTH_CODE,
        };

        if (!credentials.auth_code) {
          delete credentials.auth_code;
        }

        if (process.env.STEAM_ACCOUNT_SENTRY_SHA) {
          this._sentry_sha = this.shaFromString(process.env.STEAM_ACCOUNT_SENTRY_SHA);
        }

        this.debugLog('Credentials set from env');
      } else {
        try {
          credentials = JSON.parse(fs.readFileSync(this._credentials_file));

          this.debugLog('Credentials set from file');
        } catch (error) {
          this.errorLog('Error loading credentials file: ', this._credentials_file);
          return false;
        }
      }
    }

    this._credentials = credentials;

    return true;
  }

  credentialsFileSet(credentials_path) {
    if (credentials_path === false) {
      this.debugLog('Credentials file disabled');
      return;
    }

    if (!credentials_path) {
      this.debugLog('No credentials file provided. Using default');
      credentials_path = 'credentials.json';
    }

    this._credentials_file = this.resolvePath(this._base_path, credentials_path);

    if (!fs.existsSync(this._credentials_file)) {
      this.credentialsFileUpdate({});
    }
  }

  credentialsFileUpdate(credentials) {
    if (!this._credentials_file) {
      this.debugLog('Credentials file disabled. Credentials will not be persisted.');
      return;
    }

    this.debugLog('Persisting credentials to file: ', this._credentials_file);
    try {
      fs.writeFileSync(this._credentials_file, JSON.stringify(credentials, null, 2));
    } catch (error) {
      this.debugLog('Error persisting credentials to file: ', this._credentials_file);
      this._csgoClient.exit();
    }
  }

  credentialsValid() {
    this.debugLog('Authentication User: ', this._credentials.account_name);
    return !!(this._credentials.account_name && this._credentials.password);
  }

  prepareStorage() {
    this._base_path = this.resolvePath(this._base_path);

    try {
      var stat = fs.lstatSync(this._base_path);

      if (!stat.isDirectory()) {
        this.errorLog('Invalid storage path: ', this._base_path);
        return false;
      }

      this.debugLog('Storage path: ', this._base_path);
      return true;
    } catch (error) {
      this.debugLog('Preparing storage path: ', this._base_path);
    }

    try {
      fs.mkdirSync(this._base_path);
    } catch (error) {
      this.errorLog('Error creating storage path: ', this._base_path);
      return false;
    }

    return true;
  }

  resolvePath(...parts) {
    var paths = [];

    for (var part of parts) {
      if (part.startsWith('~')) {
        part = path.join(process.env.HOME, part.slice(1));
      } else if (part.startsWith('./')) {
        part = path.join(path.resolve(), part.slice(2));
      }

      paths.push(part);
    }

    return path.resolve(...paths);
  }

  sentryFileLoad() {
    if (!this._sentry_file) {
      return false;
    }

    try {
      var sentry = fs.readFileSync(this._sentry_file);
      if (sentry.length) {
        this._sentry_sha = this.shaFromBytes(sentry);

        this.debugLog('Sentry file loaded');
        this.debugLog('Sentry SHA: ', this.shaToString(this._sentry_sha));
      }
    } catch (error) {
      this.errorLog('Error loading sentry file: ', this._sentry_file);
      return false;
    }
  }

  sentryFileSet(sentry_path) {
    if (!sentry_path) {
      this.debugLog('No sentry file provided. Using default');
      sentry_path = 'sentry';
    }

    this._sentry_file = this.resolvePath(this._base_path, sentry_path);

    if (!fs.existsSync(this._sentry_file)) {
      this.sentryFileUpdate('');
    }
  }

  sentryFileUpdate(sentry) {
    if (!this._sentry_file) {
      this.debugLog('Sentry file disabled. Sentry will not be persisted.');
      return;
    }

    if (sentry.length > 0) {
      this._sentry_sha = this.shaFromBytes(sentry.bytes);
      this.debugLog('Sentry SHA: ', this.shaToString(this._sentry_sha));
    } else {
      this._sentry_sha = null;
    }

    this.debugLog('Persisting sentry to file: ', this._sentry_file);
    try {
      fs.writeFileSync(this._sentry_file, sentry);
    } catch (error) {
      this.debugLog('Error persisting sentry to file: ', this._sentry_file);
      this._csgoClient.exit();
    }

    return this._sentry_sha;
  }

  sentryFileValid() {
    if (!this._sentry_file || !fs.existsSync(this._sentry_file)) {
      return false;
    }

    var stat = fs.statSync(this._sentry_file);

    return stat.isFile() && stat.size === 2048;
  }

  serversLoad(servers) {
    if (servers.length) {
      Steam.servers = servers;
    } else {
      this.debugLog('No servers found. Using default servers.');
    }

    this.debugLog('Servers available: ', Steam.servers.length);
  }

  serversFileSet(servers_file) {
    if (!servers_file) {
      this.debugLog('No servers file provided. Using default servers.');
      this.debugLog('Servers available: ', Steam.servers.length);
      return true;
    }

    this._servers_file = path.resolve(servers_file);

    try {
      var servers = JSON.parse(fs.readFileSync(this._servers_file));
      this.serversLoad(servers);
    } catch (error) {
      this.errorLog('Error loading servers file: ', this._servers_file);
      return false;
    }

    return true;
  }

  serversFileUpdate(servers) {
    if (!this._servers_file) {
      this.debugLog('Servers file disabled. Servers will not be persisted.');
      return;
    }

    this.debugLog('Persisting servers to file: ', this._servers_file);
    try {
      fs.writeFileSync(this._servers_file, JSON.stringify(servers, null, 2));
    } catch (error) {
      this.debugLog('Error persisting servers to file: ', this._servers_file);
      this._csgoClient.exit();
    }
  }

  updateFullMatchInfoFile(match) {
    var output_path = path.resolve(this._requestCode + '.json');
    try {
      fs.writeFileSync(output_path, JSON.stringify(match, null, 2));
    } catch (error) {
      this.errorLog('Error writing full match info to file: ', output_path);
    }
  }

  shaFromBytes(bytes) {
    var hash = crypto.createHash('sha1');
    hash.update(bytes);
    return hash.digest();
  }

  shaFromString(string) {
    return Buffer.from(string.split(/(?=(?:..)*$)/).map(x => parseInt(x, 16)));
  }

  shaToString(buffer) {
    return buffer.toString('hex');
  }
}
