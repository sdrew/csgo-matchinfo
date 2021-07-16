import Steam from 'steam';
import CSGOMatchInfoUtils from './utils.js';

export default class CSGOMatchInfoHandlers extends CSGOMatchInfoUtils {
  bindHandlers() {
    this._steamClient
      .on('connected', this.onSteamClientConnected.bind(this))
      .on('error', this.onSteamClientError.bind(this))
      .on('logOnResponse', this.onSteamClientLogOn.bind(this))
      .on('sentry', this.onSteamClientSentry.bind(this))
      .on('servers', this.onSteamClientServers.bind(this));

    this._steamUser.on('updateMachineAuth', this.onSteamUserUpdateMachineAuth.bind(this));

    this._csgoClient
      .on('exited', this.onCSGOClientExited.bind(this))
      .on('matchList', this.onCSGOClientMatchList.bind(this))
      .on('playerProfile', this.onCSGOClientPlayerProfile.bind(this))
      .on('ready', this.onCSGOClientReady.bind(this))
      .on('unready', this.onCSGOClientUnready.bind(this));
  }

  onCSGOClientExited(args) {
    this.debugLog('CSGO Client Exit');
    process.exit();
  }

  onCSGOClientMatchList(matchList) {
    this.matchInfoResponse(matchList.matches[0]);
  }

  onCSGOClientPlayerProfile(profile) {
    this.profileInfoResponse(profile);
  }

  onCSGOClientReady() {
    this.debugLog('CSGO Ready');

    switch (this._requestAction) {
      case 'match':
        this.matchInfoRequest();
        break;
      case 'profile':
        this.profileInfoRequest();
        break;
      default:
        this.errorLog('Unknown Action');
        this._csgoClient.exit();
        break;
    }
  }

  onCSGOClientUnready() {
    this.debugLog('CSGO unready.');
  }

  onSteamClientConnected() {
    this.debugLog('Connected to Steam');
    this._steamUser.logOn(this.getAuth());
  }

  onSteamClientError(error) {
    this.errorLog('Client Error:', error);
    process.exit(10);
  }

  onSteamClientLogOn(response) {
    if (response.eresult == Steam.EResult.OK) {
      this.debugLog('Logged in');
    } else {
      this.errorLog('Login Error: ', response);
      this._csgoClient.exit();
      return;
    }

    this.debugLog('Current SteamID64: ' + this._steamClient.steamID);
    this.debugLog('Account ID: ' + this._csgoClient.ToAccountID(this._steamClient.steamID));

    this._csgoClient.launch();
  }

  onSteamClientSentry(sentry) {
    this.debugLog('Received Sentry');
    return this.sentryFileUpdate(sentry);
  }

  onSteamClientServers(servers) {
    this.debugLog('Received Servers');
    this.serversLoad(servers);
    this.serversFileUpdate(servers);
  }

  onSteamUserUpdateMachineAuth(response, callback) {
    sentry_sha = this.onSteamClientSentry(response);
    callback({ sha_file: sentry_sha });
  }
}
