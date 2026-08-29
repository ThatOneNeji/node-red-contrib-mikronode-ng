const should = require('should');
const helper = require('node-red-node-test-helper');
const mikrotikConfigNode = require('../nodes/mikrotik-config.js');
const mikrotikRoutesNode = require('../nodes/mikrotik-routes.js');

helper.init(require.resolve('node-red'));

describe('mikrotik-routes node', function () {
    afterEach(function () {
        helper.unload();
    });

    it('should load and link to its configured device', function (done) {
        const flow = [
            { id: 'n1', type: 'mikrotik-routes', device: 'c1', wires: [[]] },
            { id: 'c1', type: 'mikrotik-config', host: '127.0.0.1', port: '18728', reconnect: false }
        ];
        const credentials = { c1: { user: 'admin', password: 'secret' } };
        helper.load([mikrotikConfigNode, mikrotikRoutesNode], flow, credentials, function () {
            const n1 = helper.getNode('n1');
            n1.device.should.have.property('id', 'c1');
            done();
        });
    });
});
