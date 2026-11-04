module.exports = function (RED) {
    'use strict';

    const MikroNode = require('@thatoneneji/mikronode-ng');
    const createMonitorNode = require('./lib/monitor-node');

    // The configuration each wifi interface is actually running with: for old CAPsMAN
    // that's what the manager pushed to each remote CAP, for new CAPsMAN the wifi
    // interfaces themselves (local and CAP-provisioned alike).
    function basePath(config) {
        return config.capsman === 'old' ? '/caps-man/actual-interface-configuration' : '/interface/wifi';
    }

    const feature = {
        topic: function (config) {
            return config.capsman === 'old' ? 'wifi-cfg-old' : 'wifi-cfg-new';
        },
        // Two modes, mirroring mikrotik-wifi-registration (confirmed against a real
        // device via mikronode-ng's examples/monitorWifiCfg.js):
        // - No interval: print once for the initial snapshot, then .../listen for
        //   change-only deltas. A removed interface arrives as just
        //   {".id": ..., ".dead": "true"}.
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
        }
    };

    RED.nodes.registerType('mikrotik-wifi-config', createMonitorNode(RED, MikroNode, feature));
};
