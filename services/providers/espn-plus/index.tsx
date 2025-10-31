import {Hono} from 'hono';

import {db} from '@/services/database';
import {Login} from '@/services/providers/espn-plus/views/Login';
import {ESPNPlusBody} from '@/services/providers/espn-plus/views/CardBody';
import {IProvider} from '@/services/shared-interfaces';
import {removeEntriesProvider, scheduleEntries} from '@/services/build-schedule';
import {espnHandler, IEspnPlusMeta, TESPNPlusTokens} from '@/services/espn-handler';

export const espnplus = new Hono().basePath('/espnplus');

const scheduleEvents = async () => {
  await espnHandler.getSchedule();
  await scheduleEntries();
};

const removeEvents = async () => {
  await removeEntriesProvider('espn');
};

espnplus.put('/toggle', async c => {
  const body = await c.req.parseBody();
  const enabled = body['espnplus-enabled'] === 'on';

  if (!enabled) {
    await db.providers.updateAsync<IProvider, any>({name: 'espnplus'}, {$set: {enabled, tokens: {}}});
    removeEvents();

    return c.html(<></>);
  }

  await espnHandler.refreshInMarketTeams();

  return c.html(<Login />);
});

espnplus.put('/toggle-ppv', async c => {
  const body = await c.req.parseBody();
  const use_ppv = body['espnplus-ppv-enabled'] === 'on';

  const {affectedDocuments} = await db.providers.updateAsync<IProvider<TESPNPlusTokens, IEspnPlusMeta>, any>(
    {name: 'espnplus'},
    {$set: {'meta.use_ppv': use_ppv}},
    {returnUpdatedDocs: true},
  );
  const {enabled, tokens, meta} = affectedDocuments as IProvider<TESPNPlusTokens, IEspnPlusMeta>;

  scheduleEvents();

  return c.html(<ESPNPlusBody enabled={enabled} tokens={tokens} meta={meta} />);
});

espnplus.put('/refresh-in-market-teams', async c => {
  const {zip_code, in_market_teams} = await espnHandler.refreshInMarketTeams();

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
    },
  );
});

espnplus.put('/toggle-studio', async c => {
  const body = await c.req.parseBody();
  const hide_studio = body['espnplus-hide-studio'] === 'on';

  await db.providers.updateAsync<IProvider<TESPNPlusTokens, IEspnPlusMeta>, any>(
    {name: 'espnplus'},
    {$set: {'meta.hide_studio': hide_studio}},
    {returnUpdatedDocs: true},
  );

  return c.html(<></>);
});

// NEW: Linear channel toggle route for ESPN Plus
espnplus.put('/channels/toggle/:channelId', async c => {
  const channelId = c.req.param('channelId');
  const body = await c.req.parseBody();
  const enabled = body['channel-enabled'] === 'on';

// Global provider source selection
espnplus.put('/channels/source', async c => {
  const body = await c.req.parseBody();
  const providerChoice = (body['channel-source'] as string)?.toLowerCase() ?? 'auto';

  const validChoices = ['auto', 'espn', 'espnplus'];
  if (!validChoices.includes(providerChoice)) {
    return c.text('Invalid provider choice', 400);
  }

  const updateFields: Record<string, any> = {};
  const channels = ['espn1', 'espn2', 'espnu', 'sec', 'acc', 'espnews', 'espndeportes', 'espnonabc'];
  for (const ch of channels) {
    updateFields[`meta.${ch}_provider`] = providerChoice;
  }

  await db.providers.updateAsync(
    { name: 'espnplus' },
    { $set: updateFields }
  );

  return c.html(<></>, 200, {
    'HX-Trigger': `{"HXToast":{"type":"success","body":"Global provider source set to ${providerChoice.toUpperCase()}"}}`,
  });
});


  // === Channel source selection route (TVE vs ESPN+) ===
espnplus.put('/channels/source/:channelId', async c => {
  const channelId = c.req.param('channelId');
  const body = await c.req.parseBody();

  // Explicitly cast to string
  const providerChoice = (body['channel-source'] as string)?.toLowerCase() ?? 'auto';

  // Validate input
  const validChoices = ['auto', 'espn', 'espnplus'];
  if (!validChoices.includes(providerChoice)) {
    return c.text('Invalid provider choice', 400);
  }

  await db.providers.updateAsync(
    { name: 'espnplus' },
    { $set: { [`meta.${channelId}_provider`]: providerChoice } }
  );

  return c.html(<></>, 200, {
    'HX-Trigger': `{"HXToast":{"type":"success","body":"Provider source updated"}}`,
  });
});


  // Update the specific channel in meta
  await db.providers.updateAsync(
    {name: 'espnplus'},
    {$set: {[`meta.${channelId}`]: enabled}},
  );

  // Rebuild schedule when channels are toggled
  scheduleEvents();

  return c.html(
    <input
      hx-target="this"
      hx-swap="outerHTML"
      type="checkbox"
      checked={enabled}
      data-enabled={enabled ? 'true' : 'false'}
      hx-put={`/providers/espnplus/channels/toggle/${channelId}`}
      hx-trigger="change"
      name="channel-enabled"
    />,
  );
});

espnplus.get('/login/check/:code', async c => {
  const code = c.req.param('code');

  const isAuthenticated = await espnHandler.authenticatePlusRegCode();

  if (!isAuthenticated) {
    return c.html(<Login code={code} />);
  }

  const {affectedDocuments} = await db.providers.updateAsync<IProvider<TESPNPlusTokens, IEspnPlusMeta>, any>(
    {name: 'espnplus'},
    {$set: {enabled: true}},
    {returnUpdatedDocs: true},
  );
  const {tokens, meta} = affectedDocuments as IProvider<TESPNPlusTokens, IEspnPlusMeta>;

  // Kickoff event scheduler
  scheduleEvents();

  return c.html(<ESPNPlusBody enabled={true} tokens={tokens} meta={meta} open={true} />, 200, {
    'HX-Trigger': `{"HXToast":{"type":"success","body":"Successfully enabled ESPN+"}}`,
  });
});

espnplus.put('/reauth', async c => {
  return c.html(<Login />);
});