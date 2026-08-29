// Runs against real MikroTik devices instead of a mocked Connection/Channel - opt-in
// via env vars (see .env.example), so it never runs as part of the default `npm test`
// used by CI.
//
// Three devices, matching real-world failure modes that are hard to fake convincingly
// with a mock:
//   MIKROTIK_HOST/USER/PASSWORD           - a reachable device, correct credentials
//   MIKROTIK_BAD_HOST/BAD_USER/BAD_PASSWORD - a reachable device, wrong credentials
//   MIKROTIK_DOWN_HOST                    - DNS resolves, nothing is listening
require('dotenv').config();

const should = require('should');
const helper = require('node-red-node-test-helper');
const mikrotikConfigNode = require('../../nodes/mikrotik-config.js');
const mikrotikRoutesNode = require('../../nodes/mikrotik-routes.js');
const mikrotikStatusNode = require('../../nodes/mikrotik-status.js');

helper.init(require.resolve('node-red'));

const HOST = process.env.MIKROTIK_HOST;
const USER = process.env.MIKROTIK_USER;
const PASSWORD = process.env.MIKROTIK_PASSWORD;

const BAD_HOST = process.env.MIKROTIK_BAD_HOST;
const BAD_USER = process.env.MIKROTIK_BAD_USER;
const BAD_PASSWORD = process.env.MIKROTIK_BAD_PASSWORD;

const DOWN_HOST = process.env.MIKROTIK_DOWN_HOST;

describe('live device integration', function () {
    this.timeout(15000);

    afterEach(function () {
        helper.unload();
    });

    it('mikrotik-config should connect with correct credentials', function (done) {
        if (!HOST || !USER || !PASSWORD) {
            return this.skip();
        }
        const flow = [{ id: 'c1', type: 'mikrotik-config', host: HOST, reconnect: false }];
        const credentials = { c1: { user: USER, password: PASSWORD } };
        helper.load(mikrotikConfigNode, flow, credentials, function () {
            const c1 = helper.getNode('c1');
            if (c1.connected) {
                return done();
            }
            c1.on('mikrotik-connected', function () {
                c1.connected.should.be.true();
                done();
            });
        });
    });

    it('mikrotik-config should connect over TLS (API-SSL)', function (done) {
        if (!HOST || !USER || !PASSWORD) {
            return this.skip();
        }
        const flow = [{ id: 'c1', type: 'mikrotik-config', host: HOST, tls: true, reconnect: false }];
        const credentials = { c1: { user: USER, password: PASSWORD } };
        helper.load(mikrotikConfigNode, flow, credentials, function () {
            const c1 = helper.getNode('c1');
            if (c1.connected) {
                return done();
            }
            c1.on('mikrotik-connected', function () {
                c1.connected.should.be.true();
                done();
            });
        });
    });

    it('mikrotik-config should surface a login failure for wrong credentials', function (done) {
        if (!BAD_HOST || !BAD_USER) {
            return this.skip();
        }
        const flow = [{ id: 'c1', type: 'mikrotik-config', host: BAD_HOST, reconnect: false }];
        // Deliberately wrong, regardless of whatever BAD_PASSWORD actually is - this
        // test is about the failure path, not about that specific value being invalid.
        const credentials = { c1: { user: BAD_USER, password: BAD_PASSWORD + '-definitely-wrong' } };
        helper.load(mikrotikConfigNode, flow, credentials, function () {
            const c1 = helper.getNode('c1');
            // Assert on the real Connection's own 'trap' event rather than node.error's
            // sinon spy, since that only tells you it was *ever* called, not when -
            // and this fires asynchronously, well after helper.load's callback.
            c1.connection.on('trap', function (trap) {
                trap.errors[0].message.should.match(/invalid user name or password/i);
                done();
            });
        });
    });

    it('mikrotik-config should surface a connection failure for an unreachable device', function (done) {
        if (!DOWN_HOST) {
            return this.skip();
        }
        const flow = [{ id: 'c1', type: 'mikrotik-config', host: DOWN_HOST, reconnect: false }];
        const credentials = { c1: { user: 'mikronode', password: 'irrelevant' } };
        helper.load(mikrotikConfigNode, flow, credentials, function () {
            const c1 = helper.getNode('c1');
            c1.connection.on('error', function (err) {
                String(err).should.match(/EHOSTUNREACH|ECONNREFUSED|ETIMEDOUT/);
                done();
            });
        });
    });

    it('mikrotik-routes should emit a snapshot then continue streaming from a real device', function (done) {
        if (!BAD_HOST || !BAD_USER || !BAD_PASSWORD) {
            return this.skip();
        }
        const flow = [
            { id: 'n1', type: 'mikrotik-routes', device: 'c1', wires: [['n2']] },
            { id: 'c1', type: 'mikrotik-config', name: 'Testing device', host: BAD_HOST, reconnect: false },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = { c1: { user: BAD_USER, password: BAD_PASSWORD } };
        helper.load([mikrotikConfigNode, mikrotikRoutesNode], flow, credentials, function () {
            const n2 = helper.getNode('n2');
            // Node-RED's runtime wraps a node's 'input' handler, so an assertion
            // thrown in here doesn't fail the test cleanly - it gets swallowed and the
            // test just hangs until mocha's own timeout. Catch and forward explicitly.
            n2.on('input', function (msg) {
                try {
                    msg.should.have.property('topic', 'routes');
                    msg.should.have.property('name', 'Testing device');
                    msg.should.have.property('hostname', BAD_HOST);
                    msg.timestamp.should.be.a.Number();
                    msg.should.have.property('payload');
                    Array.isArray(msg.payload).should.be.true();
                    msg.payload.length.should.be.above(0);
                    // mikronode-ng coerces unambiguous numeric strings - 'distance' is
                    // one of the route fields that's always a plain integer on the wire.
                    msg.payload[0].distance.should.be.a.Number();
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    it('mikrotik-status should report the device\'s connection status', function (done) {
        if (!BAD_HOST || !BAD_USER || !BAD_PASSWORD) {
            return this.skip();
        }
        const flow = [
            { id: 'n1', type: 'mikrotik-status', device: 'c1', wires: [['n2']] },
            { id: 'c1', type: 'mikrotik-config', name: 'Testing device', host: BAD_HOST, reconnect: false },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = { c1: { user: BAD_USER, password: BAD_PASSWORD } };
        helper.load([mikrotikConfigNode, mikrotikStatusNode], flow, credentials, function () {
            const n2 = helper.getNode('n2');
            n2.on('input', function (msg) {
                try {
                    msg.should.have.property('topic', 'status');
                    msg.should.have.property('name', 'Testing device');
                    msg.should.have.property('hostname', BAD_HOST);
                    msg.timestamp.should.be.a.Number();
                    msg.payload.should.have.property('state', 'connected');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });
});
