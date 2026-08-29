const should = require('should');
const transformOldCapsmanRow = require('../nodes/lib/capsman-old-transform');

describe('capsman-old-transform', function () {
    // Real row captured from a live device (old CAPsMAN registration-table), values
    // as they arrive after mikronode-ng's own numeric coercion (rx-signal, vlan-id,
    // .section are already numbers; bytes/packets stay strings since they're
    // comma-pairs, which fails the coercion's "whole string is one number" check).
    const rawRow = {
        '.id': '*2',
        interface: 'Kakashi_AP_Realitystorm_2',
        ssid: 'realitystorm',
        'mac-address': 'C4:DE:E2:12:AB:B4',
        'tx-rate': '150Mbps-40MHz/1S/SGI',
        'rx-rate': '108Mbps-40MHz/1S',
        'rx-signal': -46,
        uptime: '5d2h39m39s750ms',
        packets: '203768,221860',
        bytes: '11678220,43900697',
        'tx-rate-set': 'CCK:1-11 OFDM:6-54 BW:1x-2x SGI:1x-2x HT:0-7',
        'eap-identity': '',
        'vlan-id': 200,
        'last-ip': '21.73.168.192',
        comment: 'realitystorm - tasmota-12ABB4-2996 - sonoff01 - Lounge',
        '.section': 0
    };

    it('should reshape a raw old-CAPsMAN row into the structured form', function () {
        const result = transformOldCapsmanRow(rawRow);

        result.should.have.property('mac_address', 'C4:DE:E2:12:AB:B4');
        result.should.have.property('ssid', 'realitystorm');
        result.should.have.property('comment', rawRow.comment);
        result.should.have.property('eap_identity', '');
        result.should.have.property('interface', 'Kakashi_AP_Realitystorm_2');
        result.should.have.property('uptime', '5d2h39m39s750ms');
        result.should.have.property('vlan_id', 200);
        result.should.have.property('last_ip', '21.73.168.192');

        // bytes/packets are "tx,rx" pairs - tx is index 0, rx is index 1.
        result.tx.should.have.property('bytes', 11678220);
        result.tx.should.have.property('packets', 203768);
        result.rx.should.have.property('bytes', 43900697);
        result.rx.should.have.property('packets', 221860);

        result.tx.should.have.property('rate', '150Mbps');
        result.tx.should.have.property('width', '40MHz');
        result.rx.should.have.property('rate', '108Mbps');
        result.rx.should.have.property('width', '40MHz');
        result.rx.should.have.property('signal', -46);

        result.tx.rate_sets.should.deepEqual({
            CCK: '1-11',
            OFDM: '6-54',
            BW: '1x-2x',
            SGI: '1x-2x',
            HT: '0-7'
        });

        // .id and .section are RouterOS bookkeeping, not data - dropped by design.
        result.should.not.have.property('.id');
        result.should.not.have.property('.section');
    });

    it('should handle a rate with no width component', function () {
        const result = transformOldCapsmanRow(Object.assign({}, rawRow, { 'rx-rate': '6Mbps' }));
        result.rx.should.have.property('rate', '6Mbps');
        result.rx.should.have.property('width', null);
    });

    it('should not throw on a row missing expected fields', function () {
        // The caller (mikrotik-wifi-registration.js) wraps this in try/catch and
        // falls back to the raw row - this just confirms the function itself doesn't
        // throw on a sparse/unexpected row, consistent with "best-effort".
        const result = transformOldCapsmanRow({});
        should(result.tx.bytes).be.undefined();
        should(result.tx.rate).be.null();
    });
});
