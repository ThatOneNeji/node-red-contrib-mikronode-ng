const should = require('should');
const helper = require('node-red-node-test-helper');
const mikrotikConfigNode = require('../nodes/mikrotik-config.js');

helper.init(require.resolve('node-red'));

describe('mikrotik-config node', function () {
    afterEach(function () {
        helper.unload();
    });

    it('should load with the configured properties', function (done) {
        const flow = [{
            id: 'n1',
            type: 'mikrotik-config',
            name: 'test device',
            host: '127.0.0.1',
            port: '18728',
            reconnect: false
        }];
        const credentials = { n1: { user: 'admin', password: 'secret' } };
        helper.load(mikrotikConfigNode, flow, credentials, function () {
            const n1 = helper.getNode('n1');
            n1.should.have.property('name', 'test device');
            n1.should.have.property('host', '127.0.0.1');
            n1.should.have.property('connected', false);
            done();
        });
    });

    it('should default allowSelfSigned to false', function (done) {
        const flow = [{ id: 'n1', type: 'mikrotik-config', host: '127.0.0.1', port: '18728', tls: true, reconnect: false }];
        const credentials = { n1: { user: 'admin', password: 'secret' } };
        helper.load(mikrotikConfigNode, flow, credentials, function () {
            const n1 = helper.getNode('n1');
            n1.should.have.property('allowSelfSigned', false);
            done();
        });
    });
});
