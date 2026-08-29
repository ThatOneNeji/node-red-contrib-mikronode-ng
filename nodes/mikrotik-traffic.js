module.exports = function (RED) {
    'use strict';

    const MikroNode = require('@thatoneneji/mikronode-ng');
    const createMonitorNode = require('./lib/monitor-node');

    const feature = {
        topic: 'monitor-traffic',
        command: '/interface/monitor-traffic',
        buildParams: function (config) {
            // mikronode-ng's channel.write() does not prefix object keys with '=' for
            // you - callers must, or RouterOS traps with "missing =<param>=".
            return { '=interface': config.interfaceName, '=interval': config.interval || '1' };
        }
    };

    RED.nodes.registerType('mikrotik-traffic', createMonitorNode(RED, MikroNode, feature));
};
