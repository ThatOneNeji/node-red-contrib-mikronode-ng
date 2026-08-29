module.exports = function (RED) {
    'use strict';

    // Config nodes (mikrotik-config) can't be wired on canvas - Node-RED never renders
    // category: 'config' nodes there, regardless of x/y/z. This is the wireable/
    // debuggable view of a device's connection status: an ordinary action node, same
    // device-dropdown pattern as the other Mikrotik nodes, that just forwards the
    // config node's 'mikrotik-report' events as real messages.
    function MikrotikStatusNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.device = RED.nodes.getNode(config.device);

        if (!node.device) {
            node.status({ fill: 'red', shape: 'ring', text: 'no device configured' });
            node.error('Mikrotik: no device configured');
            return;
        }

        const colors = {
            connected: 'green',
            reconnecting: 'yellow'
        };

        function onReport(msg) {
            node.status({
                fill: colors[msg.payload.state] || 'red',
                shape: msg.payload.state === 'connected' ? 'dot' : 'ring',
                text: msg.payload.state
            });
            node.send(msg);
        }

        node.device.on('mikrotik-report', onReport);

        node.on('close', function (done) {
            node.device.removeListener('mikrotik-report', onReport);
            done();
        });
    }

    RED.nodes.registerType('mikrotik-status', MikrotikStatusNode);
};
