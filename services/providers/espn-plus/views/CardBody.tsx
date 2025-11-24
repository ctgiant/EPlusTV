import {FC} from 'hono/jsx';
import {TESPNPlusTokens} from '@/services/espn-handler';
import {IProviderChannel} from '@/services/shared-interfaces';

interface IESPNPlusBodyProps {
  enabled: boolean;
  tokens?: TESPNPlusTokens;
  open?: boolean;
  linear_channels?: IProviderChannel[];
}

export const ESPNPlusBody: FC<IESPNPlusBodyProps> = ({enabled, tokens, open, linear_channels = []}) => {
  const parsedTokens = JSON.stringify(tokens, undefined, 2);

  if (!enabled) return <></>;

  return (
    <div hx-swap="outerHTML" hx-target="this">
      {linear_channels.length > 0 && (
        <>
          <summary>Linear Channels (via ESPN+ Unlimited)</summary>
          <table class="striped">
            <thead>
              <tr>
                <th></th>
                <th scope="col">Name</th>
              </tr>
            </thead>
            <tbody>
              {linear_channels.map(c => (
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
      )}

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