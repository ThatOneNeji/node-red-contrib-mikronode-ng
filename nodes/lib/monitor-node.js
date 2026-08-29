// Shared runtime behind every "action" node: open one channel on the referenced
// mikrotik-config node's shared Connection, stream its rows out as messages, and
// reopen the channel whenever that connection (re)connects. `feature` supplies the
// RouterOS API command(s), their parameters, and the topic to tag messages with.
//
// `feature.command` is the primary (usually long-running) command. RouterOS's
// `.../listen` commands only push rows when something actually changes - they don't
// dump the current state first - so a feature that needs an initial snapshot also sets
// `feature.snapshotCommand`, a one-shot command queued immediately before `command` on
// the same channel; its `done` result is sent as the first message, same as any `read`.
// `feature.snapshotCommand` may be a function returning a falsy value to skip the
// snapshot for a given config (e.g. it's redundant once `command` is itself a
// periodic `print =interval=`, which - confirmed against a real device - is what
// actually supports polling on a cadence; `listen` does not). `feature.buildSnapshotParams`
// (optional, defaults to `{}`) is separate from `feature.buildParams` since params
// meaningful to the main command (like `=interval=`) aren't necessarily accepted by
// the one-shot print/snapshot command.
function resolve(commandOrFn, config) {
    return typeof commandOrFn === 'function' ? commandOrFn(config) : commandOrFn;
}

// A trap (e.g. a configured interface that doesn't currently exist) fails the command
// outright - RouterOS won't retry it, and neither would we without this: the channel
// just sits there having failed, silent, until something else (a reconnect, a
// redeploy) happens to reopen it. Retrying on a fixed interval instead means a
// dynamic/late-appearing target (a VPN peer coming up, an interface created after
// this node started) gets picked up on its own, confirmed against a real device -
// deliberately fixed-interval rather than the connection-level reconnect's backoff,
// since a trap means "this specific request is invalid right now", not "the device is
// struggling", so there's no need to back off from retrying it.
const TRAP_RETRY_MS = 30000;

module.exports = function createMonitorNode(RED, MikroNode, feature) {
    return function MonitorNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.device = RED.nodes.getNode(config.device);

        if (!node.device) {
            node.status({ fill: 'red', shape: 'ring', text: 'no device configured' });
            node.error('Mikrotik: no device configured');
            return;
        }

        const topic = resolve(feature.topic, config);
        let channel = null;
        let retryTimer = null;

        function send(data) {
            let payload = MikroNode.parseItems(data);
            if (feature.transformPayload) {
                payload = feature.transformPayload(payload, config);
            }
            node.send({
                topic: topic,
                name: node.device.name || node.device.host,
                hostname: node.device.host,
                // Epoch milliseconds (Date.now()'s own unit) - RouterOS's own payload
                // has no notion of "when", only relative per-second counters, so this
                // is the only source of truth for capture time.
                timestamp: Date.now(),
                payload: payload
            });
        }

        function clearRetry() {
            if (retryTimer) {
                clearTimeout(retryTimer);
                retryTimer = null;
            }
        }

        function openChannel() {
            clearRetry();
            if (channel) {
                // Reconnect: the old channel belonged to a now-dead Connection and
                // won't be reused - drop it explicitly rather than leaving it to be
                // garbage-collected, so it doesn't linger holding stale listeners.
                channel.close();
            }
            channel = node.device.connection.openChannel();

            const snapshotCommand = feature.snapshotCommand && resolve(feature.snapshotCommand, config);
            if (snapshotCommand) {
                const snapshotParams = feature.buildSnapshotParams ? feature.buildSnapshotParams(config) : {};
                channel.write(snapshotCommand, snapshotParams, function () {
                    node.status({ fill: 'green', shape: 'dot', text: 'connected' });
                });
                channel.on('done', send);
            }

            channel.write(resolve(feature.command, config), feature.buildParams(config), function () {
                node.status({ fill: 'green', shape: 'dot', text: 'connected' });
            });
            channel.on('read', send);
            channel.on('trap', function (trap) {
                node.error('Mikrotik trap: ' + JSON.stringify(trap), { payload: trap });
                node.status({ fill: 'red', shape: 'ring', text: 'trap - retrying' });
                retryTimer = setTimeout(openChannel, TRAP_RETRY_MS);
            });
            // mikronode-ng's Channel independently listens for the underlying
            // Connection's own 'error' and re-emits it on itself (see lib/channel.js).
            // An EventEmitter 'error' event with no listener throws as an uncaught
            // exception in Node.js - confirmed the hard way: a real device outage
            // crashed the whole Node-RED process here, even though mikrotik-config's
            // own connection-level 'error' handler was already reporting it fine.
            // The connection-level handler (surfaced via mikrotik-status) is the
            // user-facing report; swallow the duplicate here.
            channel.on('error', function (err) {
                node.debug('Mikrotik channel error (already reported by mikrotik-config): ' + err);
            });
        }

        function onStatus(status) {
            node.status(status);
        }

        node.device.on('mikrotik-status', onStatus);
        node.device.on('mikrotik-connected', openChannel);

        if (node.device.connected) {
            openChannel();
        } else {
            node.status({ fill: 'grey', shape: 'ring', text: 'connecting' });
        }

        node.on('close', function (done) {
            clearRetry();
            node.device.removeListener('mikrotik-status', onStatus);
            node.device.removeListener('mikrotik-connected', openChannel);
            if (channel) {
                channel.close();
            }
            done();
        });
    };
};
