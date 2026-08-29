// Unit-tests listOvpnClientInterfaces (the live /interface/ovpn-client/print query
// backing the edit dialog's checkbox list) against a mocked device/channel - same
// approach as monitor-node's crash/retry regressions. No real OVPN client interface
// needed to verify the parsing/trap/timeout logic itself.
const should = require('should');
const EventEmitter = require('events');
const { listOvpnClientInterfaces } = require('../nodes/mikrotik-ovpn-client');

describe('listOvpnClientInterfaces', function () {
    it('should call back with an error if the device is not connected', function (done) {
        const device = { connected: false };
        listOvpnClientInterfaces(device, function (err, interfaces) {
            err.should.be.an.Error();
            err.message.should.match(/not connected/);
            should(interfaces).be.undefined();
            done();
        });
    });

    it('should return name/disabled pairs for each configured interface, regardless of disabled state', function (done) {
        const channel = new EventEmitter();
        channel.write = function (command, cb) { if (cb) { cb(); } };
        channel.close = function () {};
        const device = { connected: true, connection: { openChannel: function () { return channel; } } };

        listOvpnClientInterfaces(device, function (err, interfaces) {
            should(err).be.null();
            interfaces.should.deepEqual([
                { name: 'ovpn-out1', disabled: false },
                { name: 'ovpn-out2', disabled: true }
            ]);
            done();
        });

        channel.emit('done', [[
            '!re', '=name=ovpn-out1', '=disabled=false'
        ], [
            '!re', '=name=ovpn-out2', '=disabled=true'
        ]]);
    });

    it('should call back with an error on a trap', function (done) {
        const channel = new EventEmitter();
        channel.write = function (command, cb) { if (cb) { cb(); } };
        channel.close = function () {};
        const device = { connected: true, connection: { openChannel: function () { return channel; } } };

        listOvpnClientInterfaces(device, function (err) {
            err.should.be.an.Error();
            err.message.should.match(/no such command/);
            done();
        });

        channel.emit('trap', { errors: [{ message: 'no such command prefix' }] });
    });
});
