const MikroNode = require('@thatoneneji/mikronode-ng');

const LIST_TIMEOUT_MS = 8000;

// Backing a device's edit dialog: query it live for its configured OVPN client
// interfaces (regardless of disabled state - a disabled one is still worth seeing and
// selecting), so the user picks from what actually exists instead of typing names by
// hand. Opens its own short-lived channel; doesn't touch any node's already-open
// monitoring channel. Exported (rather than kept private to the RED closure below) so
// it's unit-testable against a mocked device/channel, the same way as
// monitor-node.js's crash/retry regressions - no real device needed to test the
// parsing/timeout/trap logic itself.
function listOvpnClientInterfaces(device, callback) {
    if (!device.connected) {
        callback(new Error('Device is not connected - deploy it and wait for it to connect first'));
        return;
    }

    let settled = false;
    const channel = device.connection.openChannel();

    const timer = setTimeout(function () {
        if (settled) { return; }
        settled = true;
        channel.close();
        callback(new Error('Timed out waiting for a response'));
    }, LIST_TIMEOUT_MS);

    channel.write('/interface/ovpn-client/print', function () {});
    channel.on('done', function (data) {
        if (settled) { return; }
        settled = true;
        clearTimeout(timer);
        channel.close();
        const rows = MikroNode.parseItems(data);
        callback(null, rows.map(function (row) {
            return { name: row.name, disabled: row.disabled === 'true' };
        }));
    });
    channel.on('trap', function (trap) {
        if (settled) { return; }
        settled = true;
        clearTimeout(timer);
        channel.close();
        const message = trap && Array.isArray(trap.errors)
            ? trap.errors.map(function (e) { return e.message; }).join(', ')
            : JSON.stringify(trap);
        callback(new Error(message));
    });
}

module.exports = function (RED) {
    'use strict';

    const createMonitorNode = require('./lib/monitor-node');

    RED.httpAdmin.get('/mikrotik-ovpn-client/interfaces/:deviceId', RED.auth.needsPermission('mikrotik-ovpn-client.read'), function (req, res) {
        const device = RED.nodes.getNode(req.params.deviceId);
        if (!device) {
            res.status(404).json({ error: 'Device not found - deploy it first' });
            return;
        }
        listOvpnClientInterfaces(device, function (err, interfaces) {
            if (err) {
                res.status(502).json({ error: err.message });
                return;
            }
            res.json(interfaces);
        });
    });

    const feature = {
        topic: 'ovpn-client',
        command: '/interface/ovpn-client/monitor',
        buildParams: function (config) {
            // interfaceName is an array from the edit dialog's checkbox list, but
            // accept a plain (possibly comma-separated) string too, for anything
            // deployed before that existed.
            const names = Array.isArray(config.interfaceName)
                ? config.interfaceName
                : String(config.interfaceName || '').split(',');
            // Confirmed against a real device: /interface/ovpn-client/monitor traps
            // with "missing =.id=" without a target - unlike monitor-traffic's
            // =interface=, RouterOS wants this one keyed by =.id= (still just the
            // interface name(s) in practice).
            return { '=.id': names.join(','), '=interval': config.interval || '1' };
        }
    };

    RED.nodes.registerType('mikrotik-ovpn-client', createMonitorNode(RED, MikroNode, feature));
};

module.exports.listOvpnClientInterfaces = listOvpnClientInterfaces;
