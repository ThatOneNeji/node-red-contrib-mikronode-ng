module.exports = function (RED) {
    'use strict';

    const MikroNode = require('@thatoneneji/mikronode-ng');

    function MikrotikConfigNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.host = config.host;
        node.port = config.port ? Number(config.port) : undefined;
        node.tls = !!config.tls;
        node.allowSelfSigned = !!config.allowSelfSigned;

        node.connected = false;

        node.connection = MikroNode.getConnection(node.host, node.credentials.user, node.credentials.password, {
            port: node.port,
            // rejectUnauthorized defaults to true (verify, same as tls: true) - RouterOS
            // ships self-signed certs on API-SSL by default, so this is opt-in per device.
            tls: node.tls ? { rejectUnauthorized: !node.allowSelfSigned } : false,
            reconnect: config.reconnect !== false ? { retries: Infinity, delay: 1000, maxDelay: 30000, factor: 2 } : false
        });

        // Config nodes can't be wired on canvas (Node-RED never renders category:
        // 'config' nodes there, regardless of x/y/z - confirmed the hard way). The
        // mikrotik-status action node is the wireable/debuggable view of this: it
        // subscribes to 'mikrotik-report' and forwards it as a real message.
        function report(state, extra) {
            node.emit('mikrotik-report', {
                topic: 'status',
                name: node.name || node.host,
                hostname: node.host,
                timestamp: Date.now(),
                payload: Object.assign({ state: state }, extra)
            });
        }

        // Action nodes referencing this config node each open their own channel on
        // this single shared Connection - see mikronode-ng's multi-channel-per-
        // connection support. 'mikrotik-connected' covers both the initial connect
        // and every reconnect, since either one means "(re)open your channel now".
        function announceConnected() {
            node.connected = true;
            node.emit('mikrotik-status', { fill: 'green', shape: 'dot', text: 'connected' });
            node.emit('mikrotik-connected');
            report('connected');
        }

        node.connection.on('error', function (err) {
            node.connected = false;
            node.emit('mikrotik-status', { fill: 'red', shape: 'ring', text: 'error' });
            node.error('Mikrotik connection error: ' + err);
            report('error', { message: String(err) });
        });

        // Fires on login failure (e.g. wrong credentials) - confirmed against a real
        // device: RouterOS replies with a trap ("invalid user name or password"), not
        // an 'error', and a 'close' follows right after.
        node.connection.on('trap', function (trap) {
            node.connected = false;
            node.emit('mikrotik-status', { fill: 'red', shape: 'ring', text: 'login failed' });
            const message = trap && Array.isArray(trap.errors)
                ? trap.errors.map(function (e) { return e.message; }).join(', ')
                : JSON.stringify(trap);
            node.error('Mikrotik login failed: ' + message);
            report('login-failed', { message: message });
        });

        node.connection.on('reconnecting', function (attempt) {
            node.connected = false;
            node.emit('mikrotik-status', { fill: 'yellow', shape: 'ring', text: 'reconnecting (' + attempt + ')' });
            report('reconnecting', { attempt: attempt });
        });

        node.connection.on('reconnected', announceConnected);

        node.connection.on('close', function () {
            node.connected = false;
            node.emit('mikrotik-status', { fill: 'red', shape: 'ring', text: 'disconnected' });
            report('disconnected');
        });

        node.connection.connect(announceConnected);

        node.on('close', function (done) {
            node.connection.close();
            done();
        });
    }

    RED.nodes.registerType('mikrotik-config', MikrotikConfigNode, {
        credentials: {
            user: { type: 'text' },
            password: { type: 'password' }
        }
    });
};
