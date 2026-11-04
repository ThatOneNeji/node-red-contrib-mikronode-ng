// mikronode-ng's Channel keeps every row until `done` (saveBuffer, default on, re-set to
// true by every write() as its command starts). The main command never sends `done`, so
// it must turn that off or memory grows for as long as Node-RED runs; the snapshot
// command must keep it, since its `done` carries the whole table. The fake channel below
// queues writes and, like the library, re-enables saveBuffer just before running each
// command's callback.
const should = require('should');
const EventEmitter = require('events');
const createMonitorNode = require('../nodes/lib/monitor-node');

describe('monitor-node saveBuffer', function () {
    function makeChannel() {
        const channel = new EventEmitter();
        channel.id = 1;
        channel.saveBuffer = true;
        channel.queued = [];
        channel.write = function (command, params, cb) {
            channel.queued.push({ command: command, cb: cb });
        };
        // Start the next queued command: what the library does on write() when idle,
        // or on the previous command's `done`.
        channel.startNext = function () {
            const next = channel.queued.shift();
            channel.saveBuffer = true;
            if (next.cb) { next.cb(); }
            return next.command;
        };
        channel.close = function () {};
        return channel;
    }

    function startNode(feature, channel) {
        const device = new EventEmitter();
        device.connected = true;
        device.host = 'test-host';
        device.name = 'Test Device';
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
        node.send = function () {};
        MonitorNode.call(node, { id: 'n1', device: 'dev1' });
        return node;
    }

    it('should turn saveBuffer off when the main command starts', function () {
        const channel = makeChannel();
        startNode({ topic: 'test', command: '/test/listen', buildParams: function () { return {}; } }, channel);

        channel.startNext().should.equal('/test/listen');
        channel.saveBuffer.should.be.false();
    });

    it('should keep saveBuffer on for the snapshot command and turn it off for the main one', function () {
        const channel = makeChannel();
        startNode({
            topic: 'test',
            snapshotCommand: '/test/print',
            command: '/test/listen',
            buildParams: function () { return {}; }
        }, channel);

        channel.startNext().should.equal('/test/print');
        channel.saveBuffer.should.be.true();

        channel.startNext().should.equal('/test/listen');
        channel.saveBuffer.should.be.false();
    });
});
