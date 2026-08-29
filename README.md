# node-red-contrib-mikronode-ng

Node-RED nodes for monitoring MikroTik RouterOS devices, built on
[`@thatoneneji/mikronode-ng`](https://github.com/ThatOneNeji/mikronode-ng).

**v1 scope: monitoring only** (no config/write actions).

## Nodes

- `mikrotik-config` — a device (host/port/TLS + API credentials), shared by any number
  of action nodes below. Picked from a dropdown on each action node, not wired — the
  standard Node-RED config-node pattern (like `mqtt-broker`). One underlying connection
  is opened per config node; every action node pointed at it opens its own channel on
  that same connection. Like any config node, it never appears in the main palette and
  can't be wired on canvas (Node-RED doesn't render config nodes there, full stop) - use
  `mikrotik-status` below if you want its connection status visible on a flow.
- `mikrotik-status` — an ordinary, palette-visible action node (same device-dropdown as
  the others) that reports its device's connection status as messages - the ordinary
  node to wire to a debug node while troubleshooting a device's connection. Topic
  `status`, `payload.state` is one of `connected` / `reconnecting` / `disconnected` /
  `error` / `login-failed`.
- `mikrotik-traffic` — interface traffic (`/interface/monitor-traffic`), topic
  `monitor-traffic`
- `mikrotik-wifi-registration` — wifi registration table, old or new CAPsMAN
  (`/caps-man/registration-table` or `/interface/wifi/registration-table`), topic
  `wifi-reg-old` or `wifi-reg-new`
- `mikrotik-routes` — active routes (`/ip/route`), topic `routes`
- `mikrotik-ovpn-client` — OVPN client connections (`/interface/ovpn-client/monitor`),
  topic `ovpn-client`. Once a Device is selected, its edit dialog queries the device
  live for configured OVPN client interfaces (including disabled ones) and lets you
  pick from a checkbox list instead of typing names by hand - use "Refresh from
  device" if you add this node before the device has deployed/connected.

`mikrotik-routes` and `mikrotik-wifi-registration` both take an optional **Interval**
(1-60s): left blank, they print the current state once then only emit again when
something actually changes; set, they instead re-emit the full table on that repeating
cadence (confirmed against a real device: RouterOS's `print =interval=N` does this -
`listen` does not).

`mikrotik-wifi-registration` also has an optional **Transform raw fields** checkbox,
old CAPsMAN only: RouterOS packs several distinct values into single delimited strings
here (a `"tx,rx"` comma-pair for `bytes`/`packets`, a combined rate+width string like
`"150Mbps-40MHz/1S/SGI"`, a space-separated rate-set blob) - enabling it reshapes each
row into `{tx: {...}, rx: {...}, ...}` with those pulled apart. Best-effort: a row that
doesn't match the expected shape is left raw rather than dropped or erroring. Not
available for new CAPsMAN, which uses different field names entirely.

If a data node's command traps (e.g. an interface that doesn't currently exist), it
retries automatically every 30 seconds rather than staying silent forever - useful for
a target that may only exist some of the time (a VPN peer, a dynamically created
interface).

## Output

Each action node emits one message per update:

- `msg.topic` — a short name for the feature (see above), not the underlying channel id
- `msg.name` — the device's configured name (falls back to its host)
- `msg.hostname` — the device's host
- `msg.timestamp` — when this plugin captured the message, epoch milliseconds
  (`Date.now()`) - RouterOS's own payload has no notion of "when," only relative
  per-second counters
- `msg.payload` — the parsed rows for that update (an array of objects). Values that
  are unambiguously numbers on the wire (plain integers/decimals) come through as real
  numbers, not strings - everything else (MAC addresses, `.id` values, IP/CIDR
  addresses, `true`/`false`, ...) stays a string, since those don't round-trip safely
  through `Number()`.

```json
{
  "topic": "monitor-traffic",
  "name": "Testing device",
  "hostname": "mikronode-ng.dev",
  "timestamp": 1756468143123,
  "payload": [{ "name": "ether1", "rx-bits-per-second": 101360, "...": "..." }]
}
```

## Development

```sh
npm install
npm test    # mocha + node-red-node-test-helper
npm run lint
```

See `.devcontainer/` for a local Node-RED instance to develop and manually test
the nodes against a real device.
