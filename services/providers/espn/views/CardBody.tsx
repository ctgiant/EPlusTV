import { FC } from 'hono/jsx';
import {
  IEspnMeta,
  IEspnPlusMeta,
  TESPNTokens,
  TESPNPlusTokens,
} from '@/services/espn-handler';
import { IProviderChannel } from '@/services/shared-interfaces';

// merged meta type for unified handling
export type IMergedEspnMeta = IEspnMeta & IEspnPlusMeta;

interface IESPNBodyProps {
  enabled: boolean;            // ESPN (TVE) enabled
  plusEnabled?: boolean;       // ESPN+ enabled
  tokens?: TESPNTokens;
  plusTokens?: TESPNPlusTokens;
  open?: boolean;
  channels: IProviderChannel[];
  meta: IMergedEspnMeta;
  plusMeta?: IEspnPlusMeta;
}

export const ESPNBody: FC<IESPNBodyProps> = ({
  enabled,
  plusEnabled,
  tokens,
  plusTokens,
  open,
  channels,
  meta,
  plusMeta,
}) => {
  const parsedTokens = JSON.stringify(tokens, undefined, 2);
  const parsedPlusTokens = JSON.stringify(plusTokens, undefined, 2);

  const anyEnabled = enabled || plusEnabled;

  // Determine if digital networks should display when either provider allows it
  const hasDigitalAccess =
    meta?.espn3 ||
    meta?.espn3isp ||
    meta?.sec_plus ||
    meta?.accnx ||
    meta?.espn_free ||
    plusMeta?.espn3 ||
    plusMeta?.espn3isp ||
    plusMeta?.sec_plus ||
    plusMeta?.accnx ||
    plusMeta?.espn_free;

  return (
    <div hx-swap="outerHTML" hx-target="this">
      {/* -------- LINEAR CHANNELS -------- */}
      {anyEnabled ? (
        <>
          <summary>
            <span>Linear Channels</span>
          </summary>
          <table class="striped">
            <thead>
              <tr>
                <th></th>
                <th scope="col">Name</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.id}>
                  <td>
                    <input
                      hx-target="this"
                      hx-swap="outerHTML"
                      type="checkbox"
                      checked={c.enabled}
                      data-enabled={c.enabled ? 'true' : 'false'}
                      hx-put={`/providers/espn/channels/toggle/${c.id}`}
                      hx-trigger="change"
                      name="channel-enabled"
                    />
                  </td>
                  <td>{c.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p>
        </p>
      )}

      {/* -------- DIGITAL NETWORKS -------- */}
      {anyEnabled && hasDigitalAccess ? (
        <>
          <summary>
            <span>Digital Networks</span>
          </summary>
          <table class="striped">
            <thead>
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
                    checked={
                      meta?.espn3 ||
                      meta?.espn3isp ||
                      plusMeta?.espn3 ||
                      plusMeta?.espn3isp
                    }
                    data-enabled={
                      meta?.espn3 ||
                      plusMeta?.espn3 ||
                      meta?.espn3isp ||
                      plusMeta?.espn3isp
                        ? 'true'
                        : 'false'
                    }
                    hx-put={`/providers/espn/features/toggle/espn3`}
                    hx-trigger="change"
                    name="channel-enabled"
                  />
                </td>
                <td>ESPN3</td>
              </tr>
              <tr>
                <td>
                  <input
                    hx-target="this"
                    hx-swap="outerHTML"
                    type="checkbox"
                    checked={meta?.sec_plus || plusMeta?.sec_plus}
                    data-enabled={
                      meta?.sec_plus || plusMeta?.sec_plus ? 'true' : 'false'
                    }
                    hx-put={`/providers/espn/features/toggle/sec_plus`}
                    hx-trigger="change"
                    name="channel-enabled"
                  />
                </td>
                <td>SEC Network+</td>
              </tr>
              <tr>
                <td>
                  <input
                    hx-target="this"
                    hx-swap="outerHTML"
                    type="checkbox"
                    checked={meta?.accnx || plusMeta?.accnx}
                    data-enabled={
                      meta?.accnx || plusMeta?.accnx ? 'true' : 'false'
                    }
                    hx-put={`/providers/espn/features/toggle/accnx`}
                    hx-trigger="change"
                    name="channel-enabled"
                  />
                </td>
                <td>ACC Network Extra</td>
              </tr>
              <tr>
                <td>
                  <input
                    hx-target="this"
                    hx-swap="outerHTML"
                    type="checkbox"
                    checked={meta?.espn_free || plusMeta?.espn_free}
                    data-enabled={
                      meta?.espn_free || plusMeta?.espn_free ? 'true' : 'false'
                    }
                    hx-put={`/providers/espn/features/toggle/espn_free`}
                    hx-trigger="change"
                    name="channel-enabled"
                  />
                </td>
                <td>@ESPN (Free)</td>
              </tr>
            </tbody>
          </table>
        </>
      ) : (
        anyEnabled && (
          <p>
            <em>No digital network access detected for current login.</em>
          </p>
        )
      )}

      {/* -------- TOKENS + REAUTH -------- */}
      {(enabled || plusEnabled) && (
        <details open={open}>
          <summary>Tokens</summary>
          <div>
            {enabled && (
              <>
                <h4>ESPN (TVE) Tokens</h4>
                <pre>{parsedTokens}</pre>
              </>
            )}

            {plusEnabled && (
              <>
                <h4>ESPN+ Tokens</h4>
                <pre>{parsedPlusTokens}</pre>
              </>
            )}

            {(enabled || plusEnabled) && (
              <form hx-put="/providers/espn/reauth-all" hx-trigger="submit">
                <button id="espn-reauth-all">Re-Authenticate All Enabled</button>
              </form>
            )}
          </div>
        </details>
      )}
    </div>
  );
};
