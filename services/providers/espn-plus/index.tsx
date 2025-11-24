import {Hono} from 'hono';

import {db} from '@/services/database';

import {Login} from './views/Login';
import {IProvider} from '@/services/shared-interfaces';
import {removeEntriesProvider, scheduleEntries} from '@/services/build-schedule';
import {espnHandler, IEspnPlusMeta, TESPNPlusTokens} from '@/services/espn-handler';
import {ESPNPlusBody} from './views/CardBody';

export const espnplus = new Hono().basePath('/espnplus');

const scheduleEvents = async () => {
  await espnHandler.getSchedule();
  await scheduleEntries();
};

const removeEvents = async () => {
  await removeEntriesProvider('espn');
};

// NEW: Restore linear channels on startup if ESPN+ is enabled, mirroring TVE persistence
(async () => {
  try {
    const espnPlus = await db.providers.findOneAsync<IProvider<TESPNPlusTokens>>({ name: 'espnplus' });
    const espn = await db.providers.findOneAsync<IProvider<any, any>>({ name: 'espn' });

    if (
      espnPlus?.enabled &&
      espnPlus.tokens?.account_token && // Any valid token
      espn?.enabled &&
      (!espn.linear_channels || espn.linear_channels.length === 0)
    ) {
      console.log('Restoring ESPN linear channels for ESPN+ Unlimited on startup');
      await db.providers.updateAsync(
        { name: 'espn' },
        {
          $set: {
            linear_channels: [
              { id: 'espn1', name: 'ESPN', enabled: true },
              { id: 'espn2', name: 'ESPN2', enabled: true },
              { id: 'espnu', name: 'ESPNU', enabled: true },
              { id: 'sec', name: 'SEC Network', enabled: true },
              { id: 'acc', name: 'ACC Network', enabled: true },
              { id: 'espnews', name: 'ESPNews', enabled: true },
              { id: 'espndeportes', name: 'ESPN Deportes', enabled: true },
            ],
            'meta.espn_plus_linear': true,
          },
        },
        { upsert: false }
      );
    }
  } catch (e) {
    console.error('Failed to restore ESPN+ linear channels on startup', e);
  }
})();

espnplus.put('/toggle', async c => {
  const body = await c.req.parseBody();
  const enabled = body['espnplus-enabled'] === 'on';

  if (!enabled) {
    await db.providers.updateAsync<IProvider, any>({ name: 'espnplus' }, { $set: { enabled, tokens: {} } });
    removeEvents();
    return c.html(<></>);
  }

  await espnHandler.refreshInMarketTeams();
  return c.html(<Login />);
});

espnplus.put('/toggle-ppv', async c => {
  const body = await c.req.parseBody();
  const use_ppv = body['espnplus-ppv-enabled'] === 'on';

  const { affectedDocuments } = await db.providers.updateAsync<IProvider<TESPNPlusTokens, IEspnPlusMeta>, any>(
    { name: 'espnplus' },
    { $set: { 'meta.use_ppv': use_ppv } },
    { returnUpdatedDocs: true }
  );
  const { enabled, tokens } = affectedDocuments as IProvider<TESPNPlusTokens, IEspnPlusMeta>;

  scheduleEvents();
  return c.html(<ESPNPlusBody enabled={enabled} tokens={tokens} />);
});

espnplus.put('/refresh-in-market-teams', async c => {
  const { zip_code, in_market_teams } = await espnHandler.refreshInMarketTeams();

  return c.html(
    <div>
      <pre>
        {in_market_teams} ({zip_code})
      </pre>
      <button id="espnplus-refresh-in-market-teams-button" disabled>
        Refresh In-Market Teams
      </button>
    </div>,
    200,
    {
      'HX-Trigger': `{"HXToast":{"type":"success","body":"Successfully refreshed in-market teams"}}`,
    }
  );
});

espnplus.get('/login/check/:code', async c => {
  const code = c.req.param('code');
  const isAuthenticated = await espnHandler.authenticatePlusRegCode();

  if (!isAuthenticated) {
    return c.html(<Login code={code} />);
  }

  const { affectedDocuments } = await db.providers.updateAsync<IProvider<TESPNPlusTokens>, any>(
    { name: 'espnplus' },
    { $set: { enabled: true } },
    { returnUpdatedDocs: true }
  );
  const { tokens } = affectedDocuments as IProvider<TESPNPlusTokens, IEspnPlusMeta>;

  // Populate linear_channels on 'espn' provider, preserving existing toggles if present
  const { linear_channels: existingChannels } = (await db.providers.findOneAsync<IProvider>({ name: 'espn' })) || {
    linear_channels: [],
  };
  const initialChannels = [
    { id: 'espn1', name: 'ESPN', enabled: true },
    { id: 'espn2', name: 'ESPN2', enabled: true },
    { id: 'espnu', name: 'ESPNU', enabled: true },
    { id: 'sec', name: 'SEC Network', enabled: true },
    { id: 'acc', name: 'ACC Network', enabled: true },
    { id: 'espnews', name: 'ESPNews', enabled: true },
    { id: 'espndeportes', name: 'ESPN Deportes', enabled: true },
  ];
  const channelsToSet = existingChannels.length > 0 ? existingChannels : initialChannels;

  await db.providers.updateAsync(
    { name: 'espn' },
    {
      $set: {
        enabled: true,
        linear_channels: channelsToSet,
        'meta.espn_plus_linear': true,
      },
    },
    { upsert: false }
  );

  await scheduleEvents();

  const espnProvider = await db.providers.findOneAsync<{ linear_channels?: any[] }>({ name: 'espn' });

  return c.html(
    <ESPNPlusBody enabled={true} tokens={tokens} open={true} linear_channels={espnProvider?.linear_channels || []} />,
    200,
    {
      'HX-Trigger': `{"HXToast":{"type":"success","body":"Successfully enabled ESPN+ Unlimited (includes linear channels)"}}`,
    }
  );
});

espnplus.put('/reauth', async c => {
  return c.html(<Login />);
});
