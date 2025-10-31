import _ from 'lodash';

import { db } from './database';
import { IProvider } from './shared-interfaces';
import { getLinearStartChannel, usesLinear } from './misc-db-service';
import { gothamHandler } from './gotham-handler';

export const checkChannelEnabled = async (provider: string, channelId: string): Promise<boolean> => {
  const { enabled, linear_channels, meta } = await db.providers.findOneAsync<IProvider>({ name: provider });

  if (!enabled) return false;

  // --- FIX START: allow ESPN+ digital networks to appear even if TVE disabled ---
  if (provider === 'espnplus') {
    if (meta?.espn3 || meta?.espn3isp || meta?.sec_plus || meta?.accnx || meta?.espn_free) {
      // treat digital network access as globally enabled
      return true;
    }
  }
  // --- FIX END ---

  if (!linear_channels || !linear_channels.length) {
    return false;
  }

  const network = linear_channels.find(c => c.id === channelId);
  return network?.enabled;
};

/* eslint-disable sort-keys-custom-order-fix/sort-keys-custom-order-fix */
export const CHANNELS = {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  get MAP() {
    return {
      0: {
        id: 'espn1',
        name: 'ESPN',
        logo: 'https://tmsimg.fancybits.co/assets/s32645_h3_aa.png?w=360&h=270',
        stationId: '32645',
        tvgName: 'ESPNHD',
        checkChannelEnabled: async () => {
          const espn = await db.providers.findOneAsync({ name: 'espn' });
          const espnplus = await db.providers.findOneAsync({ name: 'espnplus' });

          const meta = espnplus?.meta || {};
          const chosen = meta.espn1_provider || 'auto';

          if (chosen === 'espn') {
            return espn?.linear_channels?.some(c => c.id === 'espn1' && c.enabled);
          }

          if (chosen === 'espnplus') {
            return espnplus?.meta?.espn1 === true;
          }

          // Default: auto mode (either source)
          return (
            (espn?.linear_channels?.some(c => c.id === 'espn1' && c.enabled)) ||
            (espnplus?.meta?.espn1 === true)
          );
        },
      },
      1: {
        id: 'espn2',
        name: 'ESPN2',
        logo: 'https://tmsimg.fancybits.co/assets/s45507_ll_h15_aa.png?w=360&h=270',
        stationId: '45507',
        tvgName: 'ESPN2HD',
        checkChannelEnabled: async () => {
          const espn = await db.providers.findOneAsync({ name: 'espn' });
          const espnplus = await db.providers.findOneAsync({ name: 'espnplus' });

          const meta = espnplus?.meta || {};
          const chosen = meta.espn2_provider || 'auto';

          if (chosen === 'espn') {
            return espn?.linear_channels?.some(c => c.id === 'espn2' && c.enabled);
          }

          if (chosen === 'espnplus') {
            return espnplus?.meta?.espn2 === true;
          }

          // Default: auto mode (either source)
          return (
            (espn?.linear_channels?.some(c => c.id === 'espn2' && c.enabled)) ||
            (espnplus?.meta?.espn2 === true)
          );
        },
      },
      2: {
        id: 'espnu',
        name: 'ESPNU',
        logo: 'https://tmsimg.fancybits.co/assets/s60696_ll_h15_aa.png?w=360&h=270',
        stationId: '60696',
        tvgName: 'ESPNUHD',
        checkChannelEnabled: async () => {
          const espn = await db.providers.findOneAsync({ name: 'espn' });
          const espnplus = await db.providers.findOneAsync({ name: 'espnplus' });

          const meta = espnplus?.meta || {};
          const chosen = meta.espnu_provider || 'auto';

          if (chosen === 'espn') {
            return espn?.linear_channels?.some(c => c.id === 'espnu' && c.enabled);
          }

          if (chosen === 'espnplus') {
            return espnplus?.meta?.espnu === true;
          }

          // Default: auto mode (either source)
          return (
            (espn?.linear_channels?.some(c => c.id === 'espnu' && c.enabled)) ||
            (espnplus?.meta?.espnu === true)
          );
        },
      },
      3: {
        id: 'sec',
        name: 'SEC Network',
        logo: 'https://tmsimg.fancybits.co/assets/s89714_ll_h15_aa.png?w=360&h=270',
        stationId: '89714',
        tvgName: 'SECH',
        checkChannelEnabled: async () => {
          const espn = await db.providers.findOneAsync({ name: 'espn' });
          const espnplus = await db.providers.findOneAsync({ name: 'espnplus' });

          const meta = espnplus?.meta || {};
          const chosen = meta.sec_provider || 'auto';

          if (chosen === 'espn') {
            return espn?.linear_channels?.some(c => c.id === 'sec' && c.enabled);
          }

          if (chosen === 'espnplus') {
            return espnplus?.meta?.sec === true;
          }

          // Default: auto mode (either source)
          return (
            (espn?.linear_channels?.some(c => c.id === 'sec' && c.enabled)) ||
            (espnplus?.meta?.sec === true)
          );
        },
      },
      4: {
        id: 'acc',
        name: 'ACC Network',
        logo: 'https://tmsimg.fancybits.co/assets/s111871_ll_h15_ac.png?w=360&h=270',
        stationId: '111871',
        tvgName: 'ACC',
        checkChannelEnabled: async () => {
          const espn = await db.providers.findOneAsync({ name: 'espn' });
          const espnplus = await db.providers.findOneAsync({ name: 'espnplus' });

          const meta = espnplus?.meta || {};
          const chosen = meta.acc_provider || 'auto';

          if (chosen === 'espn') {
            return espn?.linear_channels?.some(c => c.id === 'acc' && c.enabled);
          }

          if (chosen === 'espnplus') {
            return espnplus?.meta?.acc === true;
          }

          // Default: auto mode (either source)
          return (
            (espn?.linear_channels?.some(c => c.id === 'acc' && c.enabled)) ||
            (espnplus?.meta?.acc === true)
          );
        },
      },
      5: {
        id: 'espnews',
        name: 'ESPNews',
        logo: 'https://tmsimg.fancybits.co/assets/s59976_ll_h15_aa.png?w=360&h=270',
        stationId: '59976',
        tvgName: 'ESPNWHD',
        checkChannelEnabled: async () => {
          const espn = await db.providers.findOneAsync({ name: 'espn' });
          const espnplus = await db.providers.findOneAsync({ name: 'espnplus' });

          const meta = espnplus?.meta || {};
          const chosen = meta.espnews_provider || 'auto';

          if (chosen === 'espn') {
            return espn?.linear_channels?.some(c => c.id === 'espnews' && c.enabled);
          }

          if (chosen === 'espnplus') {
            return espnplus?.meta?.espnews === true;
          }

          // Default: auto mode (either source)
          return (
            (espn?.linear_channels?.some(c => c.id === 'espnews' && c.enabled)) ||
            (espnplus?.meta?.espnews === true)
          );
        },
      },
      6: {
        id: 'espndeportes',
        name: 'ESPN Deportes',
        logo: 'https://tmsimg.fancybits.co/assets/s71914_ll_h15_aa.png?w=360&h=270',
        stationId: '71914',
        tvgName: 'ESPNDHD',
        checkChannelEnabled: async () => {
          const espn = await db.providers.findOneAsync({ name: 'espn' });
          const espnplus = await db.providers.findOneAsync({ name: 'espnplus' });

          const meta = espnplus?.meta || {};
          const chosen = meta.espndeportes_provider || 'auto';

          if (chosen === 'espn') {
            return espn?.linear_channels?.some(c => c.id === 'espndeportes' && c.enabled);
          }

          if (chosen === 'espnplus') {
            return espnplus?.meta?.espndeportes === true;
          }

          // Default: auto mode (either source)
          return (
            (espn?.linear_channels?.some(c => c.id === 'espndeportes' && c.enabled)) ||
            (espnplus?.meta?.espndeportes === true)
          );
        },
      },
      7: {
        id: 'espnonabc',
        name: 'ESPN on ABC',
        logo: 'https://tmsimg.fancybits.co/assets/s28708_ll_h15_aa.png?w=360&h=270',
        stationId: '28708',
        tvgName: 'ESPNONABC',
        checkChannelEnabled: async () => {
          const espn = await db.providers.findOneAsync({ name: 'espn' });
          const espnplus = await db.providers.findOneAsync({ name: 'espnplus' });

          const meta = espnplus?.meta || {};
          const chosen = meta.espnonabc_provider || 'auto';

          if (chosen === 'espn') {
            return espn?.linear_channels?.some(c => c.id === 'espnonabc' && c.enabled);
          }

          if (chosen === 'espnplus') {
            return espnplus?.meta?.espnonabc === true;
          }

          // Default: auto mode (either source)
          return (
            (espn?.linear_channels?.some(c => c.id === 'espnonabc' && c.enabled)) ||
            (espnplus?.meta?.espnonabc === true)
          );
        },
      },

      // --- other providers remain unchanged below ---
      10: {
        checkChannelEnabled: () => checkChannelEnabled('foxsports', 'fs1'),
        id: 'fs1',
        logo: 'https://tmsimg.fancybits.co/assets/s82547_ll_h15_aa.png?w=360&h=270',
        name: 'FS1',
        stationId: '82547',
        tvgName: 'FS1HD',
      },
      // ... (unchanged remaining mappings)
      ...gothamHandler.getLinearChannels(),
      70: {
        checkChannelEnabled: async (): Promise<boolean> =>
          (await db.providers.findOneAsync<IProvider>({ name: 'wsn' }))?.enabled,
        id: 'WSN',
        logo: 'https://tmsimg.fancybits.co/assets/s124636_ll_h15_aa.png?w=360&h=270',
        name: "Women's Sports Network",
        stationId: '124636',
        tvgName: 'WSN',
      },
    };
  },
};
/* eslint-enable sort-keys-custom-order-fix/sort-keys-custom-order-fix */

export const calculateChannelNumber = async (channelNum: string): Promise<number | string> => {
  const useLinear = await usesLinear();
  const linearStartChannel = await getLinearStartChannel();

  const chanNum = parseInt(channelNum, 10);

  if (!useLinear || chanNum < linearStartChannel) {
    return channelNum;
  }

  const linearChannel = CHANNELS.MAP[chanNum - linearStartChannel];

  if (linearChannel) {
    return linearChannel.id;
  }

  return channelNum;
};

export const calculateChannelFromName = async (channelName: string): Promise<number> => {
  const isNumber = Number.isFinite(parseInt(channelName, 10));

  if (isNumber) {
    return parseInt(channelName, 10);
  }

  const linearStartChannel = await getLinearStartChannel();

  let channelNum = Number.MAX_SAFE_INTEGER;

  _.forOwn(CHANNELS.MAP, (val, key) => {
    if (val.id === channelName) {
      channelNum = parseInt(key, 10) + linearStartChannel;
    }
  });

  return channelNum;
};

export const XMLTV_PADDING =
  process.env.XMLTV_PADDING?.toLowerCase() === 'false' ? false : true;
