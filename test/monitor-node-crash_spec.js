// Regression test for a real crash: mikronode-ng's Channel independently listens for
// the Connection's own 'error' and re-emits it on itself (lib/channel.js) - an
// EventEmitter 'error' event with no listener throws synchronously as an uncaught
// exception. Confirmed against a real device: disabling a MikroTik's port mid-session
// crashed the whole Node-RED process, even though mikrotik-config's own
// connection-level 'error' handler was already reporting it fine. This doesn't need a
// real device to reproduce - a bare EventEmitter standing in for the Channel is enough,
// since the bug is in whether *anything* listens for 'error' on it, not in what the
// error actually is.
const should = require('should');
const EventEmitter = require('events');
const createMonitorNode = require('../nodes/lib/monitor-node');

describe('monitor-node channel error handling', function () {
    it('should not crash when the channel re-emits a connection error', function () {
        const channel = new EventEmitter();
        channel.id = 1;
        channel.write = function (command, params, cb) {
            if (cb) { cb(); }
        };
        channel.close = function () {};

        const device = new EventEmitter();
        device.connected = true;
        device.host = 'test-host';
        device.name = 'Test Device';
        device.connection = { openChannel: function () { return channel; } };

        const fakeRED = {
            nodes: {
                createNode: function (node, config) {
                    node.id = config.id;
                },
                getNode: function () {
                    return device;
                }
            }
        };
        const MikroNodeStub = { parseItems: function (data) { return data; } };
        const feature = {
            topic: 'test',
            command: '/test/command',
            buildParams: function () { return {}; }
        };

        const MonitorNode = createMonitorNode(fakeRED, MikroNodeStub, feature);
        const node = new EventEmitter();
        node.status = function () {};
        node.error = function () {};
        const debugCalls = [];
        node.debug = function (msg) { debugCalls.push(msg); };
        node.send = function () {};

        MonitorNode.call(node, { id: 'n1', device: 'dev1' });

        // Would throw synchronously here (Node's EventEmitter semantics) if the fix
        // regresses - this is the actual crash reproduced, not a stand-in for it.
        channel.emit('error', new Error('read ETIMEDOUT'));

        debugCalls.length.should.equal(1);
        debugCalls[0].should.match(/ETIMEDOUT/);
    });
});
