import {FC} from 'hono/jsx';

import {IEspnPlusMeta, TESPNPlusTokens} from '@/services/espn-handler';

interface IESPNPlusBodyProps {
  enabled: boolean;
  tokens?: TESPNPlusTokens;
  meta: IEspnPlusMeta;
  open?: boolean;
}

export const ESPNPlusBody: FC<IESPNPlusBodyProps> = ({enabled, tokens, meta, open}) => {
  const parsedTokens = JSON.stringify(tokens, undefined, 2);

  if (!enabled) {
    return <></>;
  }

  return (
    <div hx-swap="outerHTML" hx-target="this">
      <summary>
        <span>Linear Channels (ESPN Unlimited)</span>
      </summary>
      <table class="striped">
        <thead>
          <tr>
            <th></th>
            <th scope="col">Name</th>
          </tr>
        </thead>
        <thead>
          <tr>
            <th colSpan={2}>
              <label>
                All Channels Source:&nbsp;
                <select
                  hx-put="/providers/espnplus/channels/source"
                  hx-trigger="change"
                  name="channel-source"
                >
                  <option value="auto" selected>Auto</option>
                  <option value="espnplus">ESPN+</option>
                  <option value="espn">TV Provider</option>
                </select>
              </label>
            </th>
          </tr>
          <tr>
            <th></th>
            <th scope="col">Name</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <input
                hx-target="this"
                hx-swap="outerHTML"
                type="checkbox"
                checked={meta.espn1}
                data-enabled={meta.espn1 ? 'true' : 'false'}
                hx-put={`/providers/espnplus/channels/toggle/espn1`}
                hx-trigger="change"
                name="channel-enabled"
              />
            </td>
            <td>ESPN</td>
          </tr>
          <tr>
            <td>
              <input
                hx-target="this"
                hx-swap="outerHTML"
                type="checkbox"
                checked={meta.espn2}
                data-enabled={meta.espn2 ? 'true' : 'false'}
                hx-put={`/providers/espnplus/channels/toggle/espn2`}
                hx-trigger="change"
                name="channel-enabled"
              />
            </td>
            <td>ESPN2</td>
          </tr>
          <tr>
            <td>
              <input
                hx-target="this"
                hx-swap="outerHTML"
                type="checkbox"
                checked={meta.espnu}
                data-enabled={meta.espnu ? 'true' : 'false'}
                hx-put={`/providers/espnplus/channels/toggle/espnu`}
                hx-trigger="change"
                name="channel-enabled"
              />
            </td>
            <td>ESPNU</td>
          </tr>
          <tr>
            <td>
              <input
                hx-target="this"
                hx-swap="outerHTML"
                type="checkbox"
                checked={meta.sec}
                data-enabled={meta.sec ? 'true' : 'false'}
                hx-put={`/providers/espnplus/channels/toggle/sec`}
                hx-trigger="change"
                name="channel-enabled"
              />
            </td>
            <td>SEC Network</td>
          </tr>
          <tr>
            <td>
              <input
                hx-target="this"
                hx-swap="outerHTML"
                type="checkbox"
                checked={meta.acc}
                data-enabled={meta.acc ? 'true' : 'false'}
                hx-put={`/providers/espnplus/channels/toggle/acc`}
                hx-trigger="change"
                name="channel-enabled"
              />
            </td>
            <td>ACC Network</td>
          </tr>
          <tr>
            <td>
              <input
                hx-target="this"
                hx-swap="outerHTML"
                type="checkbox"
                checked={meta.espnews}
                data-enabled={meta.espnews ? 'true' : 'false'}
                hx-put={`/providers/espnplus/channels/toggle/espnews`}
                hx-trigger="change"
                name="channel-enabled"
              />
            </td>
            <td>ESPNews</td>
          </tr>
          <tr>
            <td>
              <input
                hx-target="this"
                hx-swap="outerHTML"
                type="checkbox"
                checked={meta.espndeportes}
                data-enabled={meta.espndeportes ? 'true' : 'false'}
                hx-put={`/providers/espnplus/channels/toggle/espndeportes`}
                hx-trigger="change"
                name="channel-enabled"
              />
            </td>
            <td>ESPN Deportes</td>
          </tr>
          <tr>
            <td>
              <input
                hx-target="this"
                hx-swap="outerHTML"
                type="checkbox"
                checked={meta.espnonabc}
                data-enabled={meta.espnonabc ? 'true' : 'false'}
                hx-put={`/providers/espnplus/channels/toggle/espnonabc`}
                hx-trigger="change"
                name="channel-enabled"
              />
            </td>
            <td>ESPN on ABC</td>
          </tr>
        </tbody>
      </table>
      <details open={open}>
        <summary>Tokens</summary>
        <div>
          <pre>{parsedTokens}</pre>
          <form hx-put="/providers/espnplus/reauth" hx-trigger="submit">
            <button id="espnplus-reauth">Re-Authenticate</button>
          </form>
        </div>
      </details>
    </div>
  );
};