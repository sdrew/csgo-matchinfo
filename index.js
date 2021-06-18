import Steam from 'steam';
import CSGO from 'csgo';
import CSGOMatchInfoHandlers from './handlers.js';

export default class CSGOMatchInfo extends CSGOMatchInfoHandlers {
  constructor(opts = {}) {
    super();

    this._debug = !!opts.debug;
    this._env_credentials = !!opts.env;
    this._full = !!opts.full;
    this._json = !!opts.json;

    this._requestAction = null;
    this._requestCodes = null;
    this._requestCode = null;
    this._requestInfo = null;

    this._steamClient = new Steam.SteamClient();
    this._steamUser = new Steam.SteamUser(this._steamClient);
    this._steamGC = new Steam.SteamGameCoordinator(this._steamClient, 730);
    this._csgoClient = new CSGO.CSGOClient(this._steamUser, this._steamGC, this._debug);

    this._credentials = null;
    this._sentry_sha = null;

    this._base_path = opts.base_path || '~/.csgo-matchinfo';
    this._credentials_file = null;
    this._sentry_file = null;
    this._servers_file = null;

    this.bindHandlers();
    if (!this.prepareStorage()) {
      process.exit(1);
    }
  }

  fetchInfo(action, codes) {
    this._requestAction = action;
    this._requestCodes = codes;

    switch (this._requestAction) {
      case 'match':
        this.fetchMatchInfo();
        break;
      case 'profile':
        this.fetchProfileInfo();
        break;
      default:
        this.errorLog('Invalid action');
        return false;
    }

    return true;
  }

  fetchMatchInfo() {
    let validCodes = this._requestCodes.filter(this.validMatchCode.bind(this));
    if (validCodes < 1) {
      this.errorLog('Match Codes invalid: ', this._requestCodes.join(' '));
      process.exit(2);
    }
    this._requestCodes = validCodes;

    this.debugLog('Connecting...');
    this._steamClient.connect();
  }

  fetchProfileInfo() {
    this._requestCodes = this._requestCodes.map(x => {
      if (x.length === 17) {
        x = this._csgoClient.ToAccountID(x);
      }
      return `${x}`;
    });

    this._requestCodes = this._requestCodes.filter(x => {
      return x.length > 0;
    });

    console.log(this._requestCodes);
    if (this._requestCodes.length < 1) {
      this.errorLog('Account IDs invalid');
      process.exit(3);
    }

    this.debugLog('Connecting...');
    this._steamClient.connect();
  }

  getAuth() {
    var details = { ...this._credentials };

    if (!this._sentry_sha && this._sentry_file) {
      this.sentryFileLoad();
    }

    if (this._sentry_sha) {
      details.sha_sentryfile = this._sentry_sha;
    }

    if (!details.auth_code || details.sha_sentryfile) {
      delete details.auth_code;
    }

    return details;
  }

  matchInfoRequest() {
    this._requestCode = this._requestCodes.pop();
    var matchInfo = new CSGO.SharecodeDecoder(this._requestCode).decode();
    this.outputLog('=== Match Info ===');

    matchInfo.tokenId = parseInt(matchInfo.tokenId, 10);
    this._requestInfo = matchInfo;

    this._csgoClient.requestGame(matchInfo.matchId, matchInfo.outcomeId, matchInfo.tokenId);
  }

  matchInfoResponse(match) {
    this._requestInfo.matchTime = null;
    this._requestInfo.demoURL = null;
    this._requestInfo.teamScores = null;
    this._requestInfo.matchResult = null;

    if (match) {
      if (this._full) {
        this.updateFullMatchInfoFile(match.roundstatsall);
      }

      const lastRound = match.roundstatsall[match.roundstatsall.length - 1];

      this._requestInfo.matchTime = match.matchtime;
      this._requestInfo.demoURL = lastRound.map;
      this._requestInfo.teamScores = lastRound.team_scores;
      this._requestInfo.matchResult = lastRound.match_result;
    }

    if (this._json) {
      this._requestInfo = JSON.stringify(this._requestInfo);
      this._json = false;
    }

    this.outputLog(this._requestInfo);
    this._csgoClient.exit();
  }

  profileInfoRequest() {
    this._requestCode = this._requestCodes.pop();
    this.errorLog('=== Profile Info ===');

    this._csgoClient.playerProfileRequest(parseInt(this._requestCode, 10));
  }

  profileInfoResponse(profile) {
    console.log(profile.account_profiles[0]);

    this._csgoClient.exit();
  }

  validMatchCode(code = null) {
    if (!code) {
      code = this._requestCodes[0];
    }

    this.debugLog('Match Code: ', code);
    return !!code.match(/^CSGO(?:-\w{5}){5}$/);
  }
}
