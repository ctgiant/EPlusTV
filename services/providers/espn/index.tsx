import { Hono } from 'hono';

import { db } from '@/services/database';
import { Login as PlusLogin } from './views/Login'; // ESPN+ login (device code)
import { LoginTVE as TVELogin } from './views/LoginTVE'; // TVE login (device code)
import { IProvider } from '@/services/shared-interfaces';
import { removeEntriesProvider, scheduleEntries } from '@/services/build-schedule';
import {
  espnHandler,
  IEspnMeta,
  IEspnPlusMeta,
  TESPNTokens,
  TESPNPlusTokens,
} from '@/services/espn-handler';
import { ESPNBody } from './views/CardBody';

export const espn = new Hono().basePath('/espn');

// helper: kick off schedule
const scheduleEvents = async () => {
  await espnHandler.getSchedule();
  await scheduleEntries();
};

const removeEvents = async (providerName = 'espn') => {
  await removeEntriesProvider(providerName);
};

/**
 * Load current ESPN/ESPN+ state
 * Used on startup or page refresh to render the correct unified view.
 */
espn.get('/', async c => {
  const espnProv = await db.providers.findOneAsync<IProvider<TESPNTokens, IEspnMeta>>({ name: 'espn' });
  const plusProv = await db.providers.findOneAsync<IProvider<TESPNPlusTokens, IEspnPlusMeta>>({ name: 'espnplus' });

  const espnEnabled = !!espnProv?.enabled;
  const plusEnabled = !!plusProv?.enabled;

  const mergedMeta = {
    ...espnProv?.meta,
    espn_free: espnProv?.meta?.espn_free || plusProv?.meta?.espn_free,
    espn3: espnProv?.meta?.espn3 || plusProv?.meta?.espn3,
    sec_plus: espnProv?.meta?.sec_plus || plusProv?.meta?.sec_plus,
    accnx: espnProv?.meta?.accnx || plusProv?.meta?.accnx,
    espn3isp: espnProv?.meta?.espn3isp || plusProv?.meta?.espn3isp,
  };

  return c.html(
    <ESPNBody
      enabled={espnEnabled}
      plusEnabled={plusEnabled}
      tokens={espnProv?.tokens}
      plusTokens={plusProv?.tokens}
      open={true}
      channels={espnProv?.linear_channels || []}
      meta={mergedMeta}
      plusMeta={plusProv?.meta}
    />,
  );
});

/**
 * Toggle TVE (ESPN) provider
 * - preserves meta where possible
 * - triggers TVE login UI on enable so user can complete device-code auth
 */
espn.put('/toggle-tve', async c => {
  const body = await c.req.parseBody();
  const enabled = body['espn-enabled'] === 'on';

  const providerRow = await db.providers.findOneAsync<IProvider<any, IEspnMeta>>({ name: 'espn' });
  const meta = providerRow?.meta || {};

  if (!enabled) {
    await db.providers.updateAsync<IProvider, any>({ name: 'espn' }, { $set: { enabled: false, tokens: {} } });
    await removeEvents('espn');

    // Return unified body reflecting remaining provider state
    const espnProv = await db.providers.findOneAsync<IProvider<TESPNTokens, IEspnMeta>>({ name: 'espn' });
    const plusProv = await db.providers.findOneAsync<IProvider<TESPNPlusTokens, IEspnPlusMeta>>({ name: 'espnplus' });

    const mergedMeta = {
      ...espnProv?.meta,
      espn_free: espnProv?.meta?.espn_free || plusProv?.meta?.espn_free,
      espn3: espnProv?.meta?.espn3 || plusProv?.meta?.espn3,
      sec_plus: espnProv?.meta?.sec_plus || plusProv?.meta?.sec_plus,
      accnx: espnProv?.meta?.accnx || plusProv?.meta?.accnx,
      espn3isp: espnProv?.meta?.espn3isp || plusProv?.meta?.espn3isp,
    };

    return c.html(
      <ESPNBody
        enabled={false}
        plusEnabled={plusProv?.enabled ?? false}
        tokens={espnProv?.tokens}
        plusTokens={plusProv?.tokens}
        open={true}
        channels={espnProv?.linear_channels || []}
        meta={mergedMeta}
        plusMeta={plusProv?.meta}
      />,
    );
  }

  // enabling TVE: attempt to detect ISP/TV-provider access automatically
  if (await espnHandler.ispAccess()) {
    await db.providers.updateAsync<IProvider, any>(
      { name: 'espn' },
      {
        $set: {
          enabled: true,
          tokens: {},
          meta: {
            ...meta,
            espn3: true,
            espn3isp: true,
            espn_free: true,
          },
        },
      },
    );
  } else {
    await db.providers.updateAsync<IProvider, any>(
      { name: 'espn' },
      {
        $set: {
          enabled: true,
          tokens: {},
          meta: {
            ...meta,
            espn_free: true,
          },
        },
      },
    );
  }

  // Kickoff schedule and return TVE login UI to let user complete device-code auth
  scheduleEvents();

  const code = await espnHandler.getLinearAuthCode();
  return c.html(<TVELogin code={code} />, 200, {
    'HX-Trigger': `{"HXToast":{"type":"success","body":"Successfully enabled ESPN (TV Provider)"}}`,
  });
});

/**
 * Toggle ESPN+ provider
 * - enables/disables espnplus entry
 * - triggers ESPN+ device code login flow
 */
espn.put('/toggle-plus', async c => {
  const body = await c.req.parseBody();
  const enabled = body['espnplus-enabled'] === 'on';

  const plusRow = await db.providers.findOneAsync<IProvider<any, IEspnPlusMeta>>({ name: 'espnplus' });
  const meta = plusRow?.meta || {};

  if (!enabled) {
    await db.providers.updateAsync<IProvider, any>({ name: 'espnplus' }, { $set: { enabled: false, tokens: {} } });
    await removeEvents('espnplus');

    // Return unified body reflecting remaining provider state
    const espnProv = await db.providers.findOneAsync<IProvider<TESPNTokens, IEspnMeta>>({ name: 'espn' });
    const plusProv = await db.providers.findOneAsync<IProvider<TESPNPlusTokens, IEspnPlusMeta>>({ name: 'espnplus' });

    const mergedMeta = {
      ...espnProv?.meta,
      espn_free: espnProv?.meta?.espn_free || plusProv?.meta?.espn_free,
      espn3: espnProv?.meta?.espn3 || plusProv?.meta?.espn3,
      sec_plus: espnProv?.meta?.sec_plus || plusProv?.meta?.sec_plus,
      accnx: espnProv?.meta?.accnx || plusProv?.meta?.accnx,
      espn3isp: espnProv?.meta?.espn3isp || plusProv?.meta?.espn3isp,
    };

    return c.html(
      <ESPNBody
        enabled={espnProv?.enabled ?? false}
        plusEnabled={false}
        tokens={espnProv?.tokens}
        plusTokens={plusProv?.tokens}
        open={true}
        channels={espnProv?.linear_channels || []}
        meta={mergedMeta}
        plusMeta={plusProv?.meta}
      />,
    );
  }

  // enabling ESPN+ -> reset tokens, mark enabled, then show login UI
await db.providers.updateAsync<IProvider, any>(
  { name: 'espnplus' },
  {
    $set: {
      enabled: true,
      tokens: {},
      meta: {
        ...meta,
        espn_free: true,
        // Initialize digital network flags so ESPN+ can populate correctly
        espn3: meta.espn3 ?? true,
        sec_plus: meta.sec_plus ?? true,
        accnx: meta.accnx ?? true,
      },
    },
  },
);

  scheduleEvents();

  const code = await espnHandler.getPlusAuthCode();
  return c.html(<PlusLogin code={code} />, 200, {
    'HX-Trigger': `{"HXToast":{"type":"success","body":"Successfully enabled ESPN+"}}`,
  });
});

/**
 * TVE login callback (device-code check)
 * - Called repeatedly by the LoginTVE view until authentication completes
 */
espn.get('/tve-login/:code', async c => {
  const code = c.req.param('code');

  const isAuthenticated = await espnHandler.authenticateLinearRegCode(code);

  if (!isAuthenticated) {
    return c.html(<TVELogin code={code} />);
  }

  // Successful TVE auth: update provider row so digital networks / channels are enabled
  const provider = await db.providers.findOneAsync<IProvider<TESPNTokens, IEspnMeta>>({ name: 'espn' });
  const meta = provider.meta || {};

  const updatedMeta: IEspnMeta = {
    ...meta,
    espn3: true,
    sec_plus: true,
    accnx: true,
    espn_free: true,
    espn3isp: true,
  };

  const { affectedDocuments } = await db.providers.updateAsync<IProvider<TESPNTokens, IEspnMeta>, any>(
    { name: 'espn' },
    { $set: { enabled: true, meta: updatedMeta } },
    { returnUpdatedDocs: true },
  );

  const { tokens, linear_channels, meta: newMeta } = affectedDocuments as IProvider<TESPNTokens, IEspnMeta>;
  scheduleEvents();

  // Also check ESPN+ provider so we can merge meta
  const plusProvider = await db.providers.findOneAsync<IProvider<TESPNPlusTokens, IEspnPlusMeta>>({ name: 'espnplus' });

  const mergedMeta = {
    ...newMeta,
    espn_free: newMeta?.espn_free || plusProvider?.meta?.espn_free,
    espn3: newMeta?.espn3 || plusProvider?.meta?.espn3,
    sec_plus: newMeta?.sec_plus || plusProvider?.meta?.sec_plus,
    accnx: newMeta?.accnx || plusProvider?.meta?.accnx,
  };

  return c.html(
    <ESPNBody
      enabled={true}
      plusEnabled={plusProvider?.enabled ?? false}
      tokens={tokens}
      plusTokens={plusProvider?.tokens}
      open={true}
      channels={linear_channels}
      meta={mergedMeta}
      plusMeta={plusProvider?.meta}
    />,
    200,
    {
      'HX-Trigger': `{"HXToast":{"type":"success","body":"Successfully enabled ESPN (TV Provider)"}}`,
    },
  );
});

/**
 * ESPN+ login callback (device-code check)
 */
espn.get('/plus/login/check/:code', async c => {
  const code = c.req.param('code');

  // authenticatePlusRegCode returns boolean; handler saves tokens internally.
  const authSuccess = await espnHandler.authenticatePlusRegCode();

  if (!authSuccess) {
    return c.html(<PlusLogin code={code} />);
  }

  // Re-fetch provider record to get stored tokens and meta
  const plusProvider = await db.providers.findOneAsync<IProvider<TESPNPlusTokens, IEspnPlusMeta>>({
    name: 'espnplus',
  });

  if (!plusProvider) {
    return c.html(
      <div>
        <p style="color:red">ESPN+ authenticated but provider record missing.</p>
      </div>,
    );
  }

  // ensure flags set
  await db.providers.updateAsync<IProvider, any>(
    { name: 'espnplus' },
    {
      $set: {
        enabled: true,
        'meta.espn_free': true,
      },
    },
  );

  // Pull ESPN (TVE) provider to merge meta for unified UI
  const espnProvider = await db.providers.findOneAsync<IProvider<TESPNTokens, IEspnMeta>>({ name: 'espn' });
  const { enabled: espnEnabled, tokens: espnTokens, linear_channels, meta: espnMeta } = espnProvider || {};

  const mergedMeta = {
    ...espnMeta,
    espn_free: espnMeta?.espn_free || plusProvider?.meta?.espn_free,
    espn3: espnMeta?.espn3 || plusProvider?.meta?.espn3,
    sec_plus: espnMeta?.sec_plus || plusProvider?.meta?.sec_plus,
    accnx: espnMeta?.accnx || plusProvider?.meta?.accnx,
  };

  scheduleEvents();

  return c.html(
    <ESPNBody
      enabled={espnEnabled}
      plusEnabled={true}
      tokens={espnTokens}
      plusTokens={plusProvider?.tokens}
      open={true}
      channels={linear_channels || []}
      meta={mergedMeta}
      plusMeta={plusProvider?.meta}
    />,
    200,
    {
      'HX-Trigger': `{"HXToast":{"type":"success","body":"Successfully enabled ESPN+"}}`,
    },
  );
});

/**
 * Unified linear channel toggle:
 * - toggles espn.linear_channels entry
 * - mirrors the same enabled state into espnplus.meta.<channelId>
 */
espn.put('/channels/toggle/:id', async c => {
  const channelId = c.req.param('id'); // e.g. 'espn1', 'espn2', 'espnu', ...
  const espnProvider = await db.providers.findOneAsync<IProvider<TESPNTokens, IEspnMeta>>({ name: 'espn' });
  const { linear_channels } = espnProvider || {};
  const body = await c.req.parseBody();
  const enabled = body['channel-enabled'] === 'on';

  const updatedChannels = (linear_channels || []).map(ch => {
    if (ch.id === channelId) {
      return { ...ch, enabled };
    }
    return ch;
  });

  await db.providers.updateAsync<IProvider, any>({ name: 'espn' }, { $set: { linear_channels: updatedChannels } });

  // Mirror to espnplus.meta.<channelId>
  await db.providers.updateAsync<IProvider, any>({ name: 'espnplus' }, { $set: { [`meta.${channelId}`]: enabled } });

  scheduleEvents();

  return c.html(
    <input
      hx-target="this"
      hx-swap="outerHTML"
      type="checkbox"
      checked={enabled ? true : false}
      data-enabled={enabled ? 'true' : 'false'}
      hx-put={`/providers/espn/channels/toggle/${channelId}`}
      hx-trigger="change"
      name="channel-enabled"
    />,
  );
});

/**
 * Per-channel source selection (keeps espnplus.meta.<id>_provider)
 */
espn.put('/channels/source/:channelId', async c => {
  const channelId = c.req.param('channelId');
  const body = await c.req.parseBody();
  const providerChoice = (body['channel-source'] as string)?.toLowerCase() ?? 'auto';
  const validChoices = ['auto', 'espn', 'espnplus'];
  if (!validChoices.includes(providerChoice)) {
    return c.text('Invalid provider choice', 400);
  }

  await db.providers.updateAsync({ name: 'espnplus' }, { $set: { [`meta.${channelId}_provider`]: providerChoice } });

  return c.html(<></>, 200, {
    'HX-Trigger': `{"HXToast":{"type":"success","body":"Provider source updated"}}`,
  });
});

/**
 * Global provider selection for all linear channels (sets espnplus.meta.<id>_provider for each)
 */
espn.put('/channels/source', async c => {
  const body = await c.req.parseBody();
  const providerChoice = (body['channel-source'] as string)?.toLowerCase() ?? 'auto';
  const validChoices = ['auto', 'espn', 'espnplus'];
  if (!validChoices.includes(providerChoice)) {
    return c.text('Invalid provider choice', 400);
  }

  const channels = ['espn1', 'espn2', 'espnu', 'sec', 'acc', 'espnews', 'espndeportes', 'espnonabc'];
  const updates: Record<string, any> = {};
  for (const ch of channels) {
    updates[`meta.${ch}_provider`] = providerChoice;
  }

  await db.providers.updateAsync({ name: 'espnplus' }, { $set: updates });

  return c.html(<></>, 200, {
    'HX-Trigger': `{"HXToast":{"type":"success","body":"Global provider source set"}}`,
  });
});

/**
 * Reauthentication routes
 *
 * - PUT /reauth => refresh tokens for enabled providers (non-interactive)
 * - PUT /reauth-all => refresh tokens for all enabled providers (non-interactive)
 * - PUT /reauth-plus => start device-code flow for ESPN+ if you want interactive
 * - PUT /reauth-tve => start device-code flow for TVE if interactive
 */
espn.put('/reauth', async c => {
  try {
    // Use handler's refreshTokens() which refreshes both ESPN+ and TVE tokens where appropriate.
    await espnHandler.refreshTokens();

    const espnProv = await db.providers.findOneAsync<IProvider<TESPNTokens, IEspnMeta>>({ name: 'espn' });
    const plusProv = await db.providers.findOneAsync<IProvider<TESPNPlusTokens, IEspnPlusMeta>>({ name: 'espnplus' });

    const mergedMeta = {
      ...espnProv?.meta,
      espn_free: espnProv?.meta?.espn_free || plusProv?.meta?.espn_free,
      espn3: espnProv?.meta?.espn3 || plusProv?.meta?.espn3,
      sec_plus: espnProv?.meta?.sec_plus || plusProv?.meta?.sec_plus,
      accnx: espnProv?.meta?.accnx || plusProv?.meta?.accnx,
      espn3isp: espnProv?.meta?.espn3isp || plusProv?.meta?.espn3isp,
    };

    return c.html(
      <ESPNBody
        enabled={espnProv?.enabled ?? false}
        plusEnabled={plusProv?.enabled ?? false}
        tokens={espnProv?.tokens}
        plusTokens={plusProv?.tokens}
        open={true}
        channels={espnProv?.linear_channels || []}
        meta={mergedMeta}
        plusMeta={plusProv?.meta}
      />,
      200,
      {
        'HX-Trigger': `{"HXToast":{"type":"success","body":"Tokens refreshed for enabled provider(s)"}}`,
      },
    );
  } catch (err) {
    console.error('Reauth error:', err);
    return c.html(
      <div>
        <p style="color:red">Error during re-authentication: {(err as Error).message}</p>
      </div>,
      500,
      {
        'HX-Trigger': `{"HXToast":{"type":"error","body":"Re-auth failed. Check logs."}}`,
      },
    );
  }
});

/**
 * Non-interactive refresh for all enabled providers (alias to /reauth)
 */
/**
 * Non-interactive refresh for all enabled providers (alias to /reauth)
 */
espn.put('/reauth-all', async c => {
  try {
    // Directly call espnHandler.refreshTokens() as /reauth does
    await espnHandler.refreshTokens();

    const espnProv = await db.providers.findOneAsync<IProvider<TESPNTokens, IEspnMeta>>({ name: 'espn' });
    const plusProv = await db.providers.findOneAsync<IProvider<TESPNPlusTokens, IEspnPlusMeta>>({ name: 'espnplus' });

    const mergedMeta = {
      ...espnProv?.meta,
      espn_free: espnProv?.meta?.espn_free || plusProv?.meta?.espn_free,
      espn3: espnProv?.meta?.espn3 || plusProv?.meta?.espn3,
      sec_plus: espnProv?.meta?.sec_plus || plusProv?.meta?.sec_plus,
      accnx: espnProv?.meta?.accnx || plusProv?.meta?.accnx,
      espn3isp: espnProv?.meta?.espn3isp || plusProv?.meta?.espn3isp,
    };

    return c.html(
      <ESPNBody
        enabled={espnProv?.enabled ?? false}
        plusEnabled={plusProv?.enabled ?? false}
        tokens={espnProv?.tokens}
        plusTokens={plusProv?.tokens}
        open={true}
        channels={espnProv?.linear_channels || []}
        meta={mergedMeta}
        plusMeta={plusProv?.meta}
      />,
      200,
      {
        'HX-Trigger': `{"HXToast":{"type":"success","body":"Tokens refreshed for all enabled providers"}}`,
      },
    );
  } catch (err) {
    console.error('Reauth-all error:', err);
    return c.html(
      <div>
        <p style="color:red">Error during re-authentication: {(err as Error).message}</p>
      </div>,
      500,
      {
        'HX-Trigger': `{"HXToast":{"type":"error","body":"Re-auth-all failed. Check logs."}}`,
      },
    );
  }
});


/**
 * If you want interactive device-code reauth flows (show login UI again),
 * these endpoints start the device-code flow and return the login fragments:
 */
espn.put('/reauth-plus', async c => {
  const plusProv = await db.providers.findOneAsync<IProvider<TESPNPlusTokens, IEspnPlusMeta>>({ name: 'espnplus' });
  if (!plusProv?.enabled) {
    return c.text('ESPN+ not enabled', 400);
  }
  const code = await espnHandler.getPlusAuthCode();
  return c.html(<PlusLogin code={code} />, 200, { 'HX-Trigger': `{"HXToast":{"type":"info","body":"Started ESPN+ re-authentication"}}` });
});

espn.put('/reauth-tve', async c => {
  const espnProv = await db.providers.findOneAsync<IProvider<TESPNTokens, IEspnMeta>>({ name: 'espn' });
  if (!espnProv?.enabled) {
    return c.text('ESPN (TVE) not enabled', 400);
  }
  const code = await espnHandler.getLinearAuthCode();
  return c.html(<TVELogin code={code} />, 200, { 'HX-Trigger': `{"HXToast":{"type":"info","body":"Started ESPN (TVE) re-authentication"}}` });
});
