const should = require('should');
const EventEmitter = require('events');
const helper = require('node-red-node-test-helper');
const mikrotikConfigNode = require('../nodes/mikrotik-config.js');
const mikrotikLogNode = require('../nodes/mikrotik-log.js');

helper.init(require.resolve('node-red'));

describe('mikrotik-log node', function () {
    afterEach(function () {
        helper.unload();
    });

    it('should load and link to its configured device', function (done) {
        const flow = [
            { id: 'n1', type: 'mikrotik-log', device: 'c1', wires: [[]] },
            { id: 'c1', type: 'mikrotik-config', host: '127.0.0.1', port: '18728', reconnect: false }
        ];
        const credentials = { c1: { user: 'admin', password: 'secret' } };
        helper.load([mikrotikConfigNode, mikrotikLogNode], flow, credentials, function () {
            const n1 = helper.getNode('n1');
            n1.device.should.have.property('id', 'c1');
            done();
        });
    });

    // Registers the node against a fake RED and an already-connected fake device, and
    // returns every write() the node makes on its channel.
    function writesFor(config) {
        const writes = [];
        const channel = new EventEmitter();
        channel.write = function (command, params) {
            writes.push({ command: command, params: params });
        };
        channel.close = function () {};

        const device = new EventEmitter();
        device.connected = true;
        device.host = 'test-host';
        device.connection = { openChannel: function () { return channel; } };

        let LogNode;
        const fakeRED = {
            nodes: {
                createNode: function (node, cfg) { node.id = cfg.id; },
                getNode: function () { return device; },
                registerType: function (type, ctor) { LogNode = ctor; }
            }
        };
        mikrotikLogNode(fakeRED);

        const node = new EventEmitter();
        node.status = function () {};
        node.error = function () {};
        node.debug = function () {};
        node.send = function () {};
        LogNode.call(node, Object.assign({ id: 'n1', device: 'dev1' }, config));
        return writes;
    }

    it('should follow only new entries by default', function () {
        const writes = writesFor({});
        writes.should.have.length(1);
        writes[0].command.should.equal('/log/print');
        writes[0].params.should.eql({ '=follow-only': null });
    });

    it('should follow previous entries too in follow mode, with no separate snapshot', function () {
        const writes = writesFor({ mode: 'follow' });
        writes.should.have.length(1);
        writes[0].command.should.equal('/log/print');
        writes[0].params.should.eql({ '=follow': null });
    });
});
