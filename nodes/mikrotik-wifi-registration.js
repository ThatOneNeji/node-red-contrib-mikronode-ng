module.exports = function (RED) {
    'use strict';

    const MikroNode = require('@thatoneneji/mikronode-ng');
    const createMonitorNode = require('./lib/monitor-node');
    const transformOldCapsmanRow = require('./lib/capsman-old-transform');

    function basePath(config) {
        return config.capsman === 'old' ? '/caps-man/registration-table' : '/interface/wifi/registration-table';
    }

    const feature = {
        topic: function (config) {
            return config.capsman === 'old' ? 'wifi-reg-old' : 'wifi-reg-new';
        },
        // Two modes, mirroring mikrotik-routes (see its comment for the real-device
        // rationale - only independently confirmed for /ip/route/print, assumed
        // consistent here per RouterOS's general print/listen convention):
        // - No interval: print once for the initial snapshot, then .../listen for
        //   change-only deltas.
        // - Interval set: .../print =interval=N repeats the full table on that cadence
        //   by itself.
        snapshotCommand: function (config) {
            return config.interval ? null : basePath(config) + '/print';
        },
        buildSnapshotParams: function () {
            return {};
        },
        command: function (config) {
            return basePath(config) + (config.interval ? '/print' : '/listen');
        },
        buildParams: function (config) {
            return config.interval ? { '=interval': config.interval } : {};
        },
        // Opt-in, best-effort, and only for old CAPsMAN - see capsman-old-transform.js
        // for why (new CAPsMAN's field shapes haven't been matched against this at
        // all). A row that doesn't match the expected shape falls back to raw rather
        // than failing the whole update.
        transformPayload: function (rows, config) {
            if (!config.transform || config.capsman !== 'old') {
                return rows;
            }
            return rows.map(function (row) {
                try {
                    return transformOldCapsmanRow(row);
                } catch (err) {
                    return row;
                }
            });
        }
    };

    RED.nodes.registerType('mikrotik-wifi-registration', createMonitorNode(RED, MikroNode, feature));
};
