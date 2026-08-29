const should = require('should');
const helper = require('node-red-node-test-helper');
const mikrotikConfigNode = require('../nodes/mikrotik-config.js');
const mikrotikWifiNode = require('../nodes/mikrotik-wifi-registration.js');

helper.init(require.resolve('node-red'));

describe('mikrotik-wifi-registration node', function () {
    afterEach(function () {
        helper.unload();
    });

    it('should load and link to its configured device', function (done) {
        const flow = [
            { id: 'n1', type: 'mikrotik-wifi-registration', device: 'c1', capsman: 'old', wires: [[]] },
            { id: 'c1', type: 'mikrotik-config', host: '127.0.0.1', port: '18728', reconnect: false }
        ];
        const credentials = { c1: { user: 'admin', password: 'secret' } };
        helper.load([mikrotikConfigNode, mikrotikWifiNode], flow, credentials, function () {
            const n1 = helper.getNode('n1');
            n1.device.should.have.property('id', 'c1');
            done();
        });
    });
});
