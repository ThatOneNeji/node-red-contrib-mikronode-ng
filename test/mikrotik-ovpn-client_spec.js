const should = require('should');
const helper = require('node-red-node-test-helper');
const mikrotikConfigNode = require('../nodes/mikrotik-config.js');
const mikrotikOvpnNode = require('../nodes/mikrotik-ovpn-client.js');

helper.init(require.resolve('node-red'));

describe('mikrotik-ovpn-client node', function () {
    afterEach(function () {
        helper.unload();
    });

    it('should load and link to its configured device', function (done) {
        const flow = [
            { id: 'n1', type: 'mikrotik-ovpn-client', device: 'c1', wires: [[]] },
            { id: 'c1', type: 'mikrotik-config', host: '127.0.0.1', port: '18728', reconnect: false }
        ];
        const credentials = { c1: { user: 'admin', password: 'secret' } };
        helper.load([mikrotikConfigNode, mikrotikOvpnNode], flow, credentials, function () {
            const n1 = helper.getNode('n1');
            n1.device.should.have.property('id', 'c1');
            done();
        });
    });

    describe('GET /mikrotik-ovpn-client/interfaces/:deviceId', function () {
        it('should 404 for a device that does not exist (e.g. not deployed yet)', function (done) {
            helper.load([mikrotikConfigNode, mikrotikOvpnNode], [], function () {
                helper.request().get('/mikrotik-ovpn-client/interfaces/no-such-device')
                    .expect(404)
                    .end(done);
            });
        });

        it('should 502 for a device that is not connected', function (done) {
            const flow = [{ id: 'c1', type: 'mikrotik-config', host: '127.0.0.1', port: '18728', reconnect: false }];
            const credentials = { c1: { user: 'admin', password: 'secret' } };
            helper.load([mikrotikConfigNode, mikrotikOvpnNode], flow, credentials, function () {
                helper.request().get('/mikrotik-ovpn-client/interfaces/c1')
                    .expect(502)
                    .expect(function (res) {
                        res.body.error.should.match(/not connected/);
                    })
                    .end(done);
            });
        });
    });
});
