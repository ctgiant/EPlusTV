import fs from 'fs';
import fsExtra from 'fs-extra';
import path from 'path';
import axios from 'axios';
import _ from 'lodash';
import moment from 'moment';
import crypto from 'crypto';
import jwt_decode from 'jwt-decode';

import {configPath} from './config';
import {useParamount} from './networks';
import {getRandomHex, normalTimeRange} from './shared-helpers';
import {db} from './database';
import {ClassTypeWithoutMethods, IEntry, IHeaders, IProvider, TChannelPlaybackInfo} from './shared-interfaces';
import {debug} from './debug';
import {usesLinear} from './misc-db-service';

const BASE_THUMB_URL = 'https://wwwimage-us.pplusstatic.com/thumbnails/photos/w370-q80/';
const BASE_URL = 'https://www.paramountplus.com';
const TOKEN = [
'A',
'B',
'C',
'v',
'v',
'U',
'1',
'P',
'v',
'0',
'B',
'R',
'R',
'9',
'a',
'W',
'Y',
'F',
'L',
'A',
'm',
'+',
'm',
'8',
'b',
'c',
'I',
'J',
'X',
'm',
'7',
'a',
'9',
'G',
'Y',
'p',
'M',
'w',
'X',
'F',
't',
'D',
'u',
'q',
'1',
'P',
'5',
'A',
'R',
'A',
'g',
'6',
'o',
'6',
'0',
'y',
'i',
'l',
'K',
'8',
'o',
'Q',
'2',
'E',
'a',
'x',
'c',
'=',
].join('');

const instance = axios.create({
  baseURL: BASE_URL,
});

interface IParamountUserProfile {
  id: number;
  isMasterProfile: boolean;
}

interface IParamountUser {
  activeProfile: IParamountUserProfile;
  accountProfiles: IParamountUserProfile[];
}

interface IParamountEvent {
  videoContentId: string;
  startTimestamp: number;
  endTimestamp: number;
  channelName: string;
  title: string;
  filePathThumb: string;
  linear?: boolean;
  linearChannel?: string;
}

interface IDma {
  dma: string;
  tokenDetails: {
    syncBackToken: string;
    playback_url: string;
  };
}

interface IChannel {
  id: number;
  slug: string;
  channelName: string;
  local: boolean;
}

const paramountConfigPath = path.join(configPath, 'paramount_tokens.json');

const ALLOWED_LOCAL_SPORTS = ['College Basketball', 'College Football', 'NFL Football', 'Super Bowl LVIII'];

const parseAirings = async (events: IParamountEvent[]) => {
  const [now, inTwoDays] = normalTimeRange();

  for (const event of events) {
    const entryExists = await db.entries.findOneAsync<IEntry>({id: `${event.videoContentId}`});

    if (!entryExists) {
      const start = moment(event.startTimestamp);
      const end = moment(event.endTimestamp);
      const originalEnd = moment(end);

      if (!event.linear) {
        end.add(1, 'hour');
      }

      if (end.isBefore(now) || start.isAfter(inTwoDays)) {
        continue;
      }

      const categories = ['CBS Sports', 'Paramount+', event.channelName];

      console.log('Adding event: ', event.title);

      await db.entries.insertAsync<IEntry>({
        categories,
        duration: end.diff(start, 'seconds'),
        end: end.valueOf(),
        from: 'paramount+',
        id: event.videoContentId,
        image: `${BASE_THUMB_URL}${event.filePathThumb?.replace('files/', '')}`,
        name: event.title,
        network: 'Paramount+',
        originalEnd: originalEnd.valueOf(),
        start: start.valueOf(),
        ...(event.linear
          ? {
              channel: event.linearChannel,
              linear: true,
            }
          : {
              sport: event.channelName,
            }),
      });
    }
  }
};

let isParamountDisabled = false;

class ParamountHandler {
  public device_id?: string;
  public hashed_token?: string;
  public cookies?: string[];
  public expires?: number;
  public profileId?: number;

  private appConfig: any;
  private ip: string;
  private dma: IDma;

  public initialize = async () => {
    const setup = (await db.providers.countAsync({name: 'paramount'})) > 0 ? true : false;

    if (!setup) {
      const data: TParamountTokens = {};

      if (useParamount.plus) {
        this.loadJSON();

        data.cookies = this.cookies;
        data.device_id = this.device_id;
        data.expires = this.expires;
        data.hashed_token = this.hashed_token;
        data.profileId = this.profileId;
      }

      await db.providers.insertAsync<IProvider<TParamountTokens>>({
        enabled: useParamount.plus,
        linear_channels: [
          {
            enabled: useParamount.cbsSportsHq,
            id: 'cbssportshq',
            name: 'CBS Sports HQ',
            tmsId: '108919',
          },
          {
            enabled: useParamount.golazo,
            id: 'golazo',
            name: 'GOLAZO Network',
            tmsId: '133691',
          },
        ],
        name: 'paramount',
        tokens: data,
      });

      if (fs.existsSync(paramountConfigPath)) {
        fs.rmSync(paramountConfigPath);
      }
    }

    if (useParamount.plus) {
      console.log('Using PARAMOUNTPLUS variable is no longer needed. Please use the UI going forward');
    }
    if (useParamount.golazo) {
      console.log('Using GOLAZO variable is no longer needed. Please use the UI going forward');
    }
    if (useParamount.cbsSportsHq) {
      console.log('Using CBSSPORTSHQ variable is no longer needed. Please use the UI going forward');
    }

    const {enabled} = await db.providers.findOneAsync<IProvider>({name: 'paramount'});

    if (!enabled || isParamountDisabled) {
      return;
    }

    // Load tokens from local file and make sure they are valid
    await this.load();

    if (!this.appConfig) {
      await this.getAppConfig();
    }

    if (!this.profileId) {
      await this.getUserProfile();
    }
  };

  public refreshTokens = async () => {
    const {enabled} = await db.providers.findOneAsync<IProvider>({name: 'paramount'});

    if (!enabled || isParamountDisabled) {
      return;
    }

    if (moment().valueOf() > moment(this.expires).subtract(1, 'month').valueOf()) {
      await this.getNewTokens();
    }
  };

  public getSchedule = async () => {
    const {enabled} = await db.providers.findOneAsync<IProvider>({name: 'paramount'});

    if (!enabled || isParamountDisabled) {
      return;
    }

    console.log('Looking for Paramount+ events...');

    const events: IParamountEvent[] = [];

    try {
      const {data} = await instance.get<{listings: IParamountEvent[]}>(
        `/apps-api/v3.0/androidtv/hub/multi-channel-collection/live-and-upcoming.json?${new URLSearchParams({
          at: TOKEN,
          locale: 'en-us',
          platformType: 'androidtv',
          rows: '300',
          start: '0',
        })}`,
        {
          headers: {
            Cookie: this.cookies,
          },
        },
      );

      data.listings?.forEach(e => events.push(e));

      const channels = await this.getLiveChannels();

      debug.saveRequestData(data, 'paramount+local', 'epg');

      for (const c of channels) {
        try {
          const {data} = await instance.get(
            `/apps-api/v3.0/androidphone/live/channels/${c.slug}/listings.json?${new URLSearchParams({
              _clientRegion: this.appConfig.countAsyncry,
              at: TOKEN,
              locale: 'en-us',
              rows: '125',
              showListing: 'true',
              start: '0',
            })}`,
            {
              headers: {
                Cookie: this.cookies,
              },
            },
          );

          if (c.local) {
            (data.listing || []).forEach(e => {
              if (ALLOWED_LOCAL_SPORTS.includes(e.title)) {
                const transformedEvent: IParamountEvent = {
                  channelName: e.title,
                  endTimestamp: e.endTimestamp,
                  filePathThumb: e.filePathThumb,
                  startTimestamp: e.startTimestamp,
                  title: e.episodeTitle || e.title,
                  videoContentId: e.videoContentId.startsWith('_')
                    ? `${e.endTimestamp}----${e.videoContentId}`
                    : e.videoContentId,
                };

                events.push(transformedEvent);
              }
            });
          } else {
            (data.listing || []).forEach(e => {
              const transformedEvent: IParamountEvent = {
                channelName: e.title,
                endTimestamp: e.endTimestamp,
                filePathThumb: e.filePathThumb,
                linear: true,
                linearChannel: c.slug,
                startTimestamp: e.startTimestamp,
                title: e.episodeTitle || e.title,
                videoContentId: `${e.endTimestamp}::::${e.videoContentId}`,
              };

              events.push(transformedEvent);
            });
          }
        } catch (e) {
          console.error(e);
          console.log('Could not get EPG for: ', c.channelName);
        }
      }
    } catch (e) {
      console.error(e);
      console.log('Could not find events for Paramount+');
    }

    await parseAirings(events);
  };

  public getEventData = async (eventId: string): Promise<TChannelPlaybackInfo> => {
    try {
      const data = await this.getSteamData(eventId);

      if (!data) {
        throw new Error('Could not get stream data. Event might be upcoming, ended, or in blackout...');
      }

      return [data.streamingUrl, this.getPlaybackAuthToken];
    } catch (e) {
      console.error(e);
      console.log('Could not get stream information!');
    }
  };

  private getPlaybackAuthToken = async (eventId: string, headers?: IHeaders): Promise<IHeaders> => {
    let newHeaders: IHeaders = {};

    const updateLsSession = async (): Promise<void> => {
      try {
        const data = await this.getSteamData(eventId);

        newHeaders = {
          ...(data.ls_session && {
            Authorization: `Bearer ${data.ls_session}`,
          }),
        };
      } catch (e) {}
    };

    if (!headers) {
      await updateLsSession();
    } else {
      newHeaders = _.cloneDeep(headers);

      const lsSession = (headers['Authorization'] as string)?.split(' ')[1];

      if (lsSession) {
        const {exp}: {exp: number} = jwt_decode(lsSession);

        if (moment(exp * 1000).isBefore(moment().add(30, 'minutes'))) {
          await updateLsSession();
        }
      }
    }

    return newHeaders;
  };

  private getSteamData = async (id: string): Promise<{streamingUrl: string; ls_session?: string}> => {
    try {
      // Local channel stream
      if (id.indexOf('----') > -1) {
        await this.getDma();

        return {
          streamingUrl: this.dma.tokenDetails.playback_url,
        };
      } else {
        let contentId = id;

        if (id.indexOf('::::') > -1) {
          contentId = id.split('::::')[1];
        }

        const {data} = await instance.get(
          `/apps-api/v3.1/androidphone/irdeto-control/session-token.json?${new URLSearchParams({
            at: TOKEN,
            contentId,
            locale: 'en-us',
          })}`,
          {
            headers: {
              Cookie: this.cookies,
            },
          },
        );

        if (!data || !data.streamingUrl || !data.ls_session) {
          throw new Error('Could not get stream data');
        }

        return data;
      }
    } catch (e) {
      console.error(e);
      console.log('Could not get stream data');
    }
  };

  private getLiveChannels = async (): Promise<IChannel[]> => {
    if (!this.dma) {
      await this.getDma();
    }

    const useLinear = await usesLinear();

    try {
      const {data} = await instance.get<{carousel: IChannel[]}>(
        `/apps-api/v3.0/androidphone/home/configurator/channels.json?${new URLSearchParams({
          _clientRegion: this.appConfig.countAsyncry_code,
          at: TOKEN,
          dma: this.dma?.dma,
          locale: 'en-us',
          rows: '100',
          showListing: 'true',
          start: '0',
        })}`,
      );

      debug.saveRequestData(data, 'paramount+channels', 'epg');

      const channels: IChannel[] = [];

      for (const c of data.carousel) {
        if (c.local) {
          channels.push(c);
        }

        if (useLinear) {
          const {linear_channels} = await db.providers.findOneAsync<IProvider>({name: 'paramount'});

          const useCbsSportsHq = linear_channels.find(c => c.id === 'cbssportshq');
          const useGolazo = linear_channels.find(c => c.id === 'golazo');

          if (useCbsSportsHq && c.channelName === 'CBS Sports HQ') {
            channels.push(c);
          }

          if (useGolazo && c.channelName === 'CBS Sports Golazo Network') {
            channels.push(c);
          }
        }
      }

      return channels;
    } catch (e) {
      console.error(e);
      console.log('Could not get channel list for Paramount+');
    }
  };

  private getDma = async (): Promise<void> => {
    if (!this.ip) {
      await this.getIpAddress();
    }

    try {
      const {data} = await instance.get(
        `/apps-api/v3.0/androidphone/dma.json?${new URLSearchParams({
          at: TOKEN,
          did: this.device_id,
          dtp: '8',
          ipaddress: this.ip,
          is60FPS: 'true',
          locale: 'en-us',
          mvpdId: 'AllAccess',
          syncBackVersion: '3.0',
        })}`,
        {
          headers: {
            Cookie: this.cookies,
          },
        },
      );

      if (data && data.success && data.dmas && data.dmas[0]) {
        this.dma = data.dmas[0];
      }
    } catch (e) {
      console.error(e);
      console.log('Could not get DMA information');
    }
  };

  private getIpAddress = async (): Promise<void> => {
    try {
      const {data} = await instance.get(
        `/apps/user/ip.json?${new URLSearchParams({
          at: TOKEN,
          locale: 'en-us',
        })}`,
        {
          headers: {
            Cookie: this.cookies,
          },
        },
      );

      this.ip = data.ip;
    } catch (e) {
      console.error(e);
      console.log('Could not get IP address');
    }
  };

  private getAppConfig = async (): Promise<void> => {
    try {
      const {data} = await instance.get(
        `/apps-api/v2.0/androidphone/app/status.json?${new URLSearchParams({
          at: TOKEN,
          locale: 'en-us',
        })}`,
        {
          headers: {
            Cookie: this.cookies,
          },
        },
      );

      if (!data || !data.appVersion || !data.appVersion.availableInRegion) {
        console.log('Paramount+ account not available in region - disabling P+ integration...');
        isParamountDisabled = true;
        return;
      }

      if (!data.appConfig) {
        isParamountDisabled = true;
        throw new Error('Getting app config failed');
      }

      if (data.appConfig.livetv_disabled) {
        isParamountDisabled = true;
        console.log('Paramount+ account does not have access to live TV - disabling P+ integration...');
        return;
      }

      this.appConfig = data.appConfig;
    } catch (e) {
      console.error(e);
      console.log('Could not get Paramount+ app config');
    }
  };

  private getNewTokens = async (): Promise<void> => {
    try {
      const {headers} = await instance.post(
        `/apps-api/v2.0/androidtv/user/account/profile/switch/${this.profileId}.json?${new URLSearchParams({
          at: TOKEN,
          locale: 'en-us',
        })}`,
        {},
        {
          headers: {
            Cookie: this.cookies,
          },
        },
      );

      this.saveCookies(headers['set-cookie']);
    } catch (e) {
      console.error(e);
      console.log('Could not refresh tokens for Paramount+!');
    }
  };

  private getUserProfile = async (): Promise<void> => {
    try {
      const user = await this.getUser();

      if (!user || !user.activeProfile || !user.activeProfile.id) {
        const masterProfile = _.find(user.accountProfiles, p => p.isMasterProfile);

        if (!masterProfile) {
          throw new Error('Could not parse out a master profile');
        }

        this.profileId = masterProfile.id;
      } else {
        this.profileId = user.activeProfile.id;
      }

      this.save();
    } catch (e) {
      console.error(e);
      console.log('Could not get user profile!');
    }
  };

  private getUser = async (): Promise<IParamountUser> => {
    try {
      const {data} = await instance.get<IParamountUser>(
        `/apps-api/v3.0/androidtv/login/status.json?${new URLSearchParams({
          at: TOKEN,
          locale: 'en-us',
        })}`,
        {
          headers: {
            Cookie: this.cookies,
          },
        },
      );

      return data;
    } catch (e) {
      console.error(e);
      console.log('Could not get Paramount+ user!');
    }
  };

  public getAuthCode = async (): Promise<[string, string]> => {
    this.device_id = _.take(getRandomHex(), 16).join('');
    this.hashed_token = crypto
      .createHmac('sha1', 'eplustv')
      .update(this.device_id)
      .digest()
      .toString('base64')
      .substring(0, 16);

    try {
      const {data} = await instance.post(
        `/apps-api/v2.0/androidtv/ott/auth/code.json?${new URLSearchParams({
          at: TOKEN,
          deviceId: this.hashed_token,
        }).toString()}`,
      );

      return [data.activationCode, data.deviceToken];
    } catch (e) {
      console.error(e);
      console.log('Could not start the authentication process for Paramount+!');
    }
  };

  public authenticateRegCode = async (activationCode: string, deviceToken: string): Promise<boolean> => {
    const regUrl = [
      '/apps-api/v2.0/androidtv/ott/auth/status.json?',
      new URLSearchParams({
        activationCode,
        at: TOKEN,
        deviceId: this.hashed_token,
        deviceToken,
      }).toString(),
    ].join('');

    try {
      const {data, headers} = await instance.post(regUrl);

      if (!data.success) {
        return false;
      }

      this.saveCookies(headers['set-cookie']);

      if (!this.appConfig) {
        await this.getAppConfig();
      }

      if (!this.profileId) {
        await this.getUserProfile();
      }

      return true;
    } catch (e) {
      return false;
    }
  };

  private saveCookies = (cookies: string[]) => {
    this.cookies = cookies;
    this.expires = moment().add(1, 'year').valueOf();
    this.save();
  };

  private save = async () => {
    await db.providers.updateAsync({name: 'paramount'}, {$set: {tokens: _.omit(this, 'appConfig', 'ip', 'dma')}});
  };

  private load = async (): Promise<void> => {
    const {tokens} = await db.providers.findOneAsync<IProvider<TParamountTokens>>({name: 'paramount'});
    const {device_id, hashed_token, cookies, expires} = tokens || {};

    this.device_id = device_id;
    this.hashed_token = hashed_token;
    this.cookies = cookies;
    this.expires = expires;
  };

  private loadJSON = () => {
    if (fs.existsSync(paramountConfigPath)) {
      const {device_id, hashed_token, cookies, expires, profileId} = fsExtra.readJSONSync(paramountConfigPath);

      this.device_id = device_id;
      this.hashed_token = hashed_token;
      this.cookies = cookies;
      this.expires = expires;
      this.profileId = profileId;
    }
  };
}

export type TParamountTokens = ClassTypeWithoutMethods<ParamountHandler>;

export const paramountHandler = new ParamountHandler();
