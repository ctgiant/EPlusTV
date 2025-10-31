import { FC } from 'hono/jsx';

import { db } from '@/services/database';
import { IProvider } from '@/services/shared-interfaces';
import { IEspnMeta, TESPNTokens } from '@/services/espn-handler';

import { ESPNBody } from './CardBody';

export const ESPNIndex: FC = async () => {
  // Load ESPN provider (TVE). We keep espnplus data in DB untouched and used by routes.
  const { enabled, tokens, linear_channels: channels, meta } = await db.providers.findOneAsync<
    IProvider<TESPNTokens, IEspnMeta>
  >({ name: 'espn' });

  // We also want to show whether espnplus is enabled so UI can show login state
  const espnplusProvider = await db.providers.findOneAsync({ name: 'espnplus' });
  const espnplusEnabled = espnplusProvider?.enabled ?? false;

  return (
    <div>
      <section class="overflow-auto provider-section">
        <div class="grid-container">
          <h4>ESPN — Unified (TV Provider + ESPN+)</h4>

          <fieldset>
            <label>
              Provider mode:&nbsp;
              <select hx-put="/providers/espn/provider" hx-trigger="change" name="provider-mode">
                <option value="auto" selected>
                  Auto
                </option>
                <option value="espn">TV Provider</option>
                <option value="espnplus">ESPN+</option>
              </select>
            </label>
          </fieldset>
        </div>

        <div class="grid-container">
          <div>
            <fieldset>
              <label>
                ESPN TVE Login&nbsp;&nbsp;
                <input
                  hx-put={`/providers/espn/toggle-tve`}
                  hx-trigger="change"
                  hx-target="#espn-body"
                  name="espn-enabled"
                  type="checkbox"
                  role="switch"
                  checked={enabled ? true : false}
                  data-enabled={enabled ? 'true' : 'false'}
                />
              </label>
            </fieldset>
          </div>

          <div>
            <fieldset>
              <label>
                ESPN+ Login&nbsp;&nbsp;
                <input
                  hx-put={`/providers/espn/toggle-plus`}
                  hx-trigger="change"
                  hx-target="#espn-body"
                  name="espnplus-enabled"
                  type="checkbox"
                  role="switch"
                  checked={espnplusEnabled ? true : false}
                  data-enabled={espnplusEnabled ? 'true' : 'false'}
                />
              </label>
            </fieldset>
          </div>
        </div>

        <div id="espn-body" hx-swap="innerHTML">
            <ESPNBody enabled={enabled} plusEnabled={espnplusEnabled} tokens={tokens} channels={channels} meta={meta} />
        </div>
      </section>
      <hr />
    </div>
  );
};
