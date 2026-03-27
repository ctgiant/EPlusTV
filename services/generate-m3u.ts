import _ from 'lodash';
import moment from 'moment-timezone';

import {db} from './database';
import {CHANNELS} from './channels';
import {getLinearStartChannel, getNumberOfChannels, getStartChannel} from './misc-db-service';
import {IEntry} from './shared-interfaces';

export const generateM3u = async (uri: string, linear = false, excludeGracenote = false): Promise<string> => {
  const startChannel = await getStartChannel();
  const numOfChannels = await getNumberOfChannels();
  const linearStartChannel = await getLinearStartChannel();

  let m3uFile = '#EXTM3U';

  if (linear) {
    for (const key in CHANNELS.MAP) {
      const val = CHANNELS.MAP[key];

      if (val.checkChannelEnabled) {
        const enabled = await val.checkChannelEnabled();

        if (!enabled) {
          continue;
        }
      }

      // Resolve tvgName and stationId, handling async functions
      const updatedTvgName = typeof val.tvgName === 'function' ? await val.tvgName() : val.tvgName;
      const updatedStationId = typeof val.stationId === 'function' ? await val.stationId() : val.stationId;

      if (excludeGracenote && (updatedStationId || updatedTvgName)) {
        continue;
      } else if (!excludeGracenote && (!updatedStationId || !updatedTvgName)) {
        continue;
      }

      const channelNum = parseInt(key, 10) + linearStartChannel;

      if (excludeGracenote) {
        m3uFile = `${m3uFile}\n#EXTINF:0 tvg-id="${channelNum}.eplustv" channel-number="${channelNum}" tvg-chno="${channelNum}" tvg-name="${val.id}" group-title="EPlusTV", ${val.name}`;
      } else {
        m3uFile = `${m3uFile}\n#EXTINF:0 tvg-id="${channelNum}.eplustv" channel-id="${val.provider}.${val.name}" channel-number="${channelNum}" tvg-chno="${channelNum}" tvg-name="${updatedTvgName}" tvc-guide-stationid="${updatedStationId}" group-title="EPlusTV", ${val.name}`;
      }

      m3uFile = `${m3uFile}\n${uri}/channels/${channelNum}.m3u8\n`;
    }
  } else {
    _.times(numOfChannels, i => {
      const channelNum = startChannel + i;
      m3uFile = `${m3uFile}\n#EXTINF:0 tvg-id="${channelNum}.eplustv" channel-number="${channelNum}" tvg-chno="${channelNum}" tvg-name="EPlusTV ${channelNum}" group-title="EPlusTV", EPlusTV ${channelNum}`;
      m3uFile = `${m3uFile}\n${uri}/channels/${channelNum}.m3u8\n`;
    });
  }

  return m3uFile;
};

export const generateEventChannelsM3u = async (uri: string): Promise<string> => {
  const now = Date.now();

  // Only include events that haven't ended yet
  const entries = await db.entries
    .findAsync<IEntry>({
      channel: {$exists: true},
      linear: {$exists: false},
      end: {$gt: now},
    })
    .sort({start: 1});

  let m3uFile = '#EXTM3U';

  entries.forEach((entry, i) => {
    const channelNum = i + 1;
    const time = moment(entry.start).tz('America/New_York').format('MMM D hh:mm A [ET]');
    const league = entry.sport || entry.network;

    // Normalize MLB-style "Team A @ Team B - HOME" name suffix into a feed label
    let baseName = entry.name;
    let feedLabel = entry.feed || null;
    if (!feedLabel) {
      const homeAwayMatch = baseName.match(/\s+-\s+(HOME|AWAY)$/i);
      if (homeAwayMatch) {
        baseName = baseName.slice(0, homeAwayMatch.index);
        feedLabel = homeAwayMatch[1].charAt(0).toUpperCase() + homeAwayMatch[1].slice(1).toLowerCase() + ' Feed';
      }
    }

    const rawName = feedLabel ? `${baseName} (${feedLabel})` : baseName;
    const eventName = rawName.replace(/\bat\b/gi, '@');

    const displayName = `${league}: ${eventName} @ ${time} (${entry.network})`;

    m3uFile = `${m3uFile}\n#EXTINF:0 tvg-id="${entry.id}" channel-number="${channelNum}" tvg-chno="${channelNum}" tvg-name="${displayName}" tvg-logo="${entry.image}" group-title="EPlusTV", ${displayName}`;
    m3uFile = `${m3uFile}\n${uri}/channels/${entry.channel}.m3u8\n`;
  });

  return m3uFile;
};
