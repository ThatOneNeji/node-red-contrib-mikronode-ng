const should = require('should');
const helper = require('node-red-node-test-helper');
const mikrotikConfigNode = require('../nodes/mikrotik-config.js');
const mikrotikTrafficNode = require('../nodes/mikrotik-traffic.js');

helper.init(require.resolve('node-red'));

describe('mikrotik-traffic node', function () {
    afterEach(function () {
        helper.unload();
    });

    it('should load and link to its configured device', function (done) {
        const flow = [
            {
                id: 'n1', type: 'mikrotik-traffic', name: 'test traffic', device: 'c1',
                interfaceName: 'ether2', interval: '2', wires: [[]]
            },
            {
                id: 'c1', type: 'mikrotik-config', host: '127.0.0.1', port: '18728', reconnect: false
            }
        ];
        const credentials = { c1: { user: 'admin', password: 'secret' } };
        helper.load([mikrotikConfigNode, mikrotikTrafficNode], flow, credentials, function () {
            const n1 = helper.getNode('n1');
            n1.should.have.property('name', 'test traffic');
            n1.device.should.have.property('id', 'c1');
            done();
        });
    });

    it('should report an error when no device is configured', function (done) {
        const flow = [{ id: 'n1', type: 'mikrotik-traffic', device: '', wires: [[]] }];
        helper.load([mikrotikConfigNode, mikrotikTrafficNode], flow, function () {
            const n1 = helper.getNode('n1');
            n1.error.called.should.be.true();
            n1.error.getCall(0).args[0].should.match(/no device configured/);
            done();
        });
    });
});
