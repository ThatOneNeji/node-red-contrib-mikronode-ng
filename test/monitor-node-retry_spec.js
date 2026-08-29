// A trap (e.g. a configured interface that doesn't exist right now) fails the command
// outright and RouterOS won't retry it - confirmed via a real device: pointing
// mikrotik-traffic at a nonexistent interface trapped once and then just sat there,
// silent, until a reconnect or redeploy. This tests that a trapped channel schedules
// its own retry instead of staying dead - using stubbed setTimeout/clearTimeout rather
// than a real 30s wait, since the point is proving the retry is scheduled and actually
// reopens the channel when it fires, not timing the real interval.
const should = require('should');
const EventEmitter = require('events');
const createMonitorNode = require('../nodes/lib/monitor-node');

describe('monitor-node trap retry', function () {
    let originalSetTimeout;
    let originalClearTimeout;
    let scheduled;

    beforeEach(function () {
        scheduled = [];
        originalSetTimeout = global.setTimeout;
        originalClearTimeout = global.clearTimeout;
        global.setTimeout = function (fn, ms) {
            const id = scheduled.length + 1;
            scheduled.push({ id: id, fn: fn, ms: ms, cleared: false });
            return id;
        };
        global.clearTimeout = function (id) {
            const entry = scheduled.find(function (e) { return e.id === id; });
            if (entry) { entry.cleared = true; }
        };
    });

    afterEach(function () {
        global.setTimeout = originalSetTimeout;
        global.clearTimeout = originalClearTimeout;
    });

    function makeChannel() {
        const channel = new EventEmitter();
        channel.id = 1;
        channel.write = function (command, params, cb) {
            if (cb) { cb(); }
        };
        channel.close = function () {};
        return channel;
    }

    it('should schedule a retry 30s out when the channel traps, and reopen on fire', function () {
        let openChannelCalls = 0;
        const channels = [makeChannel(), makeChannel()];
        const device = new EventEmitter();
        device.connected = true;
        device.host = 'test-host';
        device.name = 'Test Device';
        device.connection = {
            openChannel: function () {
                return channels[openChannelCalls++];
            }
        };

        const fakeRED = {
            nodes: {
                createNode: function (node, config) { node.id = config.id; },
                getNode: function () { return device; }
            }
        };
        const MikroNodeStub = { parseItems: function (data) { return data; } };
        const feature = { topic: 'test', command: '/test/command', buildParams: function () { return {}; } };

        const MonitorNode = createMonitorNode(fakeRED, MikroNodeStub, feature);
        const node = new EventEmitter();
        node.status = function () {};
        node.error = function () {};
        node.debug = function () {};
        node.send = function () {};

        MonitorNode.call(node, { id: 'n1', device: 'dev1' });
        openChannelCalls.should.equal(1);

        channels[0].emit('trap', { errors: [{ message: 'input does not match any value of interface' }] });

        scheduled.length.should.equal(1);
        scheduled[0].ms.should.equal(30000);
        scheduled[0].cleared.should.be.false();

        // Simulate the retry timer firing.
        scheduled[0].fn();

        openChannelCalls.should.equal(2);
    });
});
