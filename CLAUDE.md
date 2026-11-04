# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Node-RED nodes for **live** monitoring of MikroTik RouterOS 7.x devices, built on the library
**`@thatoneneji/mikronode-ng`** (`/data/repos/_mine/mikronode-ng`, same user, its own `CLAUDE.md` and
`CHANGELOG.md`). v1 is monitor-only: no config/write actions. The difference from the existing
`node-red-contrib-mikrotik` (inject-driven request/response on `node-routeros`) is persistent channels that
push rows as they change, plus automatic reconnect.

Protocol and library bugs get fixed in mikronode-ng and released there first. This repo only consumes it.
Each library `examples/monitor*.js` mirrors one node here: when a node misbehaves (e.g. after a RouterOS
upgrade), run the matching example to tell a device/API problem from a problem in this wrapper.

## Commands

- `npm test` - unit tests (mocha + node-red-node-test-helper, mocked Connection/Channel).
- `npm run test:integration` - against real devices, opt-in via `.env` (see `.env.example`); not run in CI.
- `npm run coverage` - nyc. `npm run lint` - ESLint on `nodes/` and `test/`.

## Architecture

- `nodes/mikrotik-config.js` - config node: one `Connection` per device (with the library's `reconnect`
  option), emits `mikrotik-connected` / `mikrotik-status` to the nodes using it.
- `nodes/lib/monitor-node.js` - shared runtime for every monitor node: opens one channel on the shared
  connection, optional one-shot `snapshotCommand` (its `done` is sent as the first message), then the
  long-running `command` (`read` rows -> messages). Reopens on every (re)connect; retries every 30s on a trap.
- Feature nodes (`mikrotik-traffic`, `-routes`, `-wifi-registration`, `-wifi-config`, `-ovpn-client`,
  `-log`) are just a `feature` object (`topic`, `command`, `buildParams`, optional snapshot/transform)
  passed to `createMonitorNode`.
- Messages: `{topic, name, hostname, cmd, timestamp (epoch ms), payload: parseItems(rows)}`. `cmd` is the
  command path the rows came from (snapshot or main, no params). The topic comes
  from the feature (`routes`, `monitor-traffic`, ...), not from `channel.id`.
- Object params need the `=` prefix themselves: `{'=interface': 'ether1'}`.

## To do (from the mikronode-ng side, 2026-10-29)

Done: bumped `@thatoneneji/mikronode-ng` to `^1.5.0` (fixes named channels); `saveBuffer` turned off on
the long-running command (see Conventions, test in `test/monitor-node-savebuffer_spec.js`); new
`mikrotik-log` node (`/log/print`, `=follow-only=` or `=follow=`, topic `log`); bumped to `^1.6.0`
(examples only, no library code changes); new `mikrotik-wifi-config` node (old/new CAPsMAN, topics
`wifi-cfg-old` / `wifi-cfg-new`, no live test yet); `msg.cmd` (the command path the rows came from);
bumped to `^1.7.0` (fixes replies of several channels on one connection getting merged, confirmed on a
device: 0 rows in the wrong channel). Since 1.7.0 a snapshot's rows also arrive as `read`;
`monitor-node.js` skips them while the snapshot runs, its `done` sends the table.

1. **`mikrotik-log`: confirm on a device.** Node, spec, example flow and README entry are in; the live test
   (`mikrotik-log in follow mode ...` in `test/integration/live-device_spec.js`) hasn't been run against a
   device yet (the test devices weren't reachable when it was written).
2. **To check: empty tables in interval mode.** Seen with the library example on a device with no wifi
   clients: `print =interval=N` on an empty table emits `done` with no rows each tick, not `read`.
   `monitor-node.js` only listens for `done` when there's a snapshot command, so in interval mode an empty
   table (e.g. the last client leaves) produces **no message at all** rather than an empty payload.
   Confirm on a device and decide whether to send `[]`.
3. **Removals in change-only (`listen`) mode arrive as `{".id":"*8",".dead":"true"}`** - only the id, no
   MAC/address/name (confirmed on a device 2026-11-04 with the wifi registration table; same for
   `/ip/route/listen` and `/ip/address/listen`). Nothing here handles `.dead` yet: the message goes out
   as-is, so a flow can't tell *which* client/route left unless it remembers `.id` -> row itself. Decide
   whether the node should track rows by `.id` and fill in the removed row (or mark it, e.g.
   `payload: [{...lastKnownRow, ".dead": true}]`), or just document it in the README. Note `.dead` is the
   string `"true"`, not a boolean (`parseItems` only converts numbers).
4. **If channels ever get names** (for debugging/`channel.id`), ids must be unique per connection: two nodes
   with the same topic on one device would collide. Use `node.id`, not the topic.

## Conventions

- Node-RED >= 4, Node >= 22.9. CommonJS, 4-space indent, `function ()` with a space for anonymous functions.
- Every channel needs an `error` listener (`Channel` re-emits the connection's `error`; unhandled, it
  crashes Node-RED). The connection-level error is reported via `mikrotik-status`.
- Long-running commands (never send `done`) must set `saveBuffer = false` in their write callback, or the
  `Channel` keeps every row forever. `monitor-node.js` does this for the main command; a one-shot snapshot
  keeps buffering since its `done` carries the whole table.
- Comments explain what was confirmed against a real device; keep doing that for device-observed behaviour.
- Work on `develop`, merge to `main` for releases. Commit only when the user asks.

## Local files

`tmp/` is git-ignored and holds the user's planning notes and device dumps (`features_functions.MD`,
`node-red-plugin-checklist.md`, `notes.MD`, `publishing.MD`, `*.json`, screenshots). Its checkboxes are out
of date; ask the user what's actually done. Don't commit or reorganise it.
