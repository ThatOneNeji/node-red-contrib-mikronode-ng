// msg.cmd is the exact command path the rows came from. The library emits 'read' for
// every command's rows, the snapshot's included, so the node follows whichever command
// is running, and skips the snapshot's 'read' rows since its 'done' sends the whole
// table. The fake channel below queues writes and,
// like the library, runs each command's callback as that command starts.
const should = require('should');
const EventEmitter = require('events');
const createMonitorNode = require('../nodes/lib/monitor-node');

describe('monitor-node msg.cmd', function () {
    function makeChannel() {
        const channel = new EventEmitter();
        channel.id = 1;
        channel.queued = [];
        channel.write = function (command, params, cb) {
            channel.queued.push({ command: command, cb: cb });
        };
        channel.startNext = function () {
            const next = channel.queued.shift();
            if (next.cb) { next.cb(); }
        };
        channel.close = function () {};
        return channel;
    }

    function startNode(feature, channel) {
        const sent = [];
        const device = new EventEmitter();
        device.connected = true;
        device.host = 'test-host';
        device.connection = { openChannel: function () { return channel; } };

        const fakeRED = {
            nodes: {
                createNode: function (node, config) { node.id = config.id; },
                getNode: function () { return device; }
            }
        };
        const MikroNodeStub = { parseItems: function (data) { return data; } };

        const MonitorNode = createMonitorNode(fakeRED, MikroNodeStub, feature);
        const node = new EventEmitter();
        node.status = function () {};
        node.error = function () {};
        node.debug = function () {};
        node.send = function (msg) { sent.push(msg); };
        MonitorNode.call(node, { id: 'n1', device: 'dev1' });
        return sent;
    }

    it('should send the snapshot once, as its done, then the main command\'s rows', function () {
        const channel = makeChannel();
        const sent = startNode({
            topic: 'test',
            snapshotCommand: '/interface/wifi/print',
            command: '/interface/wifi/listen',
            buildParams: function () { return {}; }
        }, channel);

        channel.startNext();
        channel.emit('read', ['row']);
        channel.emit('done', ['row']);
        channel.startNext();
        channel.emit('read', ['change']);

        // The snapshot row's own 'read' is skipped: it goes out with the done.
        sent.map(function (m) { return [m.cmd, m.payload]; }).should.eql([
            ['/interface/wifi/print', ['row']],
            ['/interface/wifi/listen', ['change']]
        ]);
    });

    it('should carry the command path without its params', function () {
        const channel = makeChannel();
        const sent = startNode({
            topic: 'test',
            command: '/ip/route/print',
            buildParams: function () { return { '=interval': '5' }; }
        }, channel);

        channel.startNext();
        channel.emit('read', ['row']);

        sent[0].should.have.property('cmd', '/ip/route/print');
    });
});
