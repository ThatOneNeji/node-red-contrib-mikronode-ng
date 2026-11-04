const should = require('should');
const EventEmitter = require('events');
const helper = require('node-red-node-test-helper');
const mikrotikConfigNode = require('../nodes/mikrotik-config.js');
const mikrotikWifiConfigNode = require('../nodes/mikrotik-wifi-config.js');

helper.init(require.resolve('node-red'));

describe('mikrotik-wifi-config node', function () {
    afterEach(function () {
        helper.unload();
    });

    it('should load and link to its configured device', function (done) {
        const flow = [
            { id: 'n1', type: 'mikrotik-wifi-config', device: 'c1', capsman: 'old', wires: [[]] },
            { id: 'c1', type: 'mikrotik-config', host: '127.0.0.1', port: '18728', reconnect: false }
        ];
        const credentials = { c1: { user: 'admin', password: 'secret' } };
        helper.load([mikrotikConfigNode, mikrotikWifiConfigNode], flow, credentials, function () {
            const n1 = helper.getNode('n1');
            n1.device.should.have.property('id', 'c1');
            done();
        });
    });

    // Registers the node against a fake RED and an already-connected fake device, and
    // returns every write() the node makes on its channel plus every message it sends.
    function startWith(config) {
        const writes = [];
        const sent = [];
        const channel = new EventEmitter();
        channel.write = function (command, params) {
            writes.push({ command: command, params: params });
        };
        channel.close = function () {};

        const device = new EventEmitter();
        device.connected = true;
        device.host = 'test-host';
        device.connection = { openChannel: function () { return channel; } };

        let WifiConfigNode;
        const fakeRED = {
            nodes: {
                createNode: function (node, cfg) { node.id = cfg.id; },
                getNode: function () { return device; },
                registerType: function (type, ctor) { WifiConfigNode = ctor; }
            }
        };
        mikrotikWifiConfigNode(fakeRED);

        const node = new EventEmitter();
        node.status = function () {};
        node.error = function () {};
        node.debug = function () {};
        node.send = function (msg) { sent.push(msg); };
        WifiConfigNode.call(node, Object.assign({ id: 'n1', device: 'dev1' }, config));
        return { writes: writes, sent: sent, channel: channel };
    }

    it('should print a snapshot then listen on /interface/wifi for new CAPsMAN', function () {
        const writes = startWith({ capsman: 'new' }).writes;
        writes.map(function (w) { return w.command; })
            .should.eql(['/interface/wifi/print', '/interface/wifi/listen']);
        writes[1].params.should.eql({});
    });

    it('should print a snapshot then listen on actual-interface-configuration for old CAPsMAN', function () {
        const writes = startWith({ capsman: 'old' }).writes;
        writes.map(function (w) { return w.command; }).should.eql([
            '/caps-man/actual-interface-configuration/print',
            '/caps-man/actual-interface-configuration/listen'
        ]);
    });

    it('should only print on an interval, with no snapshot, when an interval is set', function () {
        const writes = startWith({ capsman: 'old', interval: '5' }).writes;
        writes.should.have.length(1);
        writes[0].command.should.equal('/caps-man/actual-interface-configuration/print');
        writes[0].params.should.eql({ '=interval': '5' });
    });

    it('should tag messages with the CAPsMAN-specific topic', function () {
        ['old', 'new'].forEach(function (capsman) {
            const started = startWith({ capsman: capsman });
            // A removal in change-only mode, as seen on a real device: only the id.
            started.channel.emit('read', [['!re', '=.id=*8', '=.dead=true']]);
            started.sent.should.have.length(1);
            started.sent[0].should.have.property('topic', 'wifi-cfg-' + capsman);
            started.sent[0].payload.should.eql([{ '.id': '*8', '.dead': 'true' }]);
        });
    });
});
