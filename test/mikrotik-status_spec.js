const should = require('should');
const helper = require('node-red-node-test-helper');
const mikrotikConfigNode = require('../nodes/mikrotik-config.js');
const mikrotikStatusNode = require('../nodes/mikrotik-status.js');

helper.init(require.resolve('node-red'));

describe('mikrotik-status node', function () {
    afterEach(function () {
        helper.unload();
    });

    it('should load and link to its configured device', function (done) {
        const flow = [
            { id: 'n1', type: 'mikrotik-status', device: 'c1', wires: [[]] },
            { id: 'c1', type: 'mikrotik-config', host: '127.0.0.1', port: '18728', reconnect: false }
        ];
        const credentials = { c1: { user: 'admin', password: 'secret' } };
        helper.load([mikrotikConfigNode, mikrotikStatusNode], flow, credentials, function () {
            const n1 = helper.getNode('n1');
            n1.device.should.have.property('id', 'c1');
            done();
        });
    });

    it('should report an error when no device is configured', function (done) {
        const flow = [{ id: 'n1', type: 'mikrotik-status', device: '', wires: [[]] }];
        helper.load([mikrotikConfigNode, mikrotikStatusNode], flow, function () {
            const n1 = helper.getNode('n1');
            n1.error.called.should.be.true();
            n1.error.getCall(0).args[0].should.match(/no device configured/);
            done();
        });
    });
});
