module.exports = function (RED) {
    'use strict';

    const MikroNode = require('@thatoneneji/mikronode-ng');
    const createMonitorNode = require('./lib/monitor-node');

    const feature = {
        topic: 'routes',
        // Two modes, both confirmed against a real device:
        // - No interval: print once for the initial snapshot, then /ip/route/listen
        //   for change-only deltas (listen never dumps an initial snapshot itself, and
        //   does not support =interval=).
        // - Interval set: /ip/route/print =interval=N repeats the full table on that
        //   cadence by itself - the separate snapshot step would be redundant.
        snapshotCommand: function (config) {
            return config.interval ? null : '/ip/route/print';
        },
        buildSnapshotParams: function () {
            return {};
        },
        command: function (config) {
            return config.interval ? '/ip/route/print' : '/ip/route/listen';
        },
        buildParams: function (config) {
            return config.interval ? { '=interval': config.interval } : {};
        }
    };

    RED.nodes.registerType('mikrotik-routes', createMonitorNode(RED, MikroNode, feature));
};
