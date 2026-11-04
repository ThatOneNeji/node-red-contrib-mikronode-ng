module.exports = function (RED) {
    'use strict';

    const MikroNode = require('@thatoneneji/mikronode-ng');
    const createMonitorNode = require('./lib/monitor-node');

    const feature = {
        topic: 'log',
        // One long-running /log/print that never sends `done`, two modes (both
        // confirmed against a real device via mikronode-ng's examples/monitorLog.js):
        // - follow-only (default): only new log entries.
        // - follow: all previous log entries, then new ones - so no snapshotCommand,
        //   the history already arrives as ordinary rows.
        // No =interval=: entries are pushed as they're logged.
        command: '/log/print',
        buildParams: function (config) {
            // The library sends a null value as `=follow-only=null`; that's what was
            // device-tested, RouterOS accepts it as the flag.
            return config.mode === 'follow' ? { '=follow': null } : { '=follow-only': null };
        }
    };

    RED.nodes.registerType('mikrotik-log', createMonitorNode(RED, MikroNode, feature));
};
