// Best-effort reshape of old CAPsMAN's (/caps-man/registration-table) rows into a
// friendlier, more structured shape. RouterOS packs several distinct pieces of
// information into single delimited strings here - this pulls them apart:
//   - "bytes"/"packets" are "tx,rx" comma-pairs, not one value each
//   - "tx-rate"/"rx-rate" pack a rate and an optional channel width together
//     ("150Mbps-40MHz/1S/SGI")
//   - "tx-rate-set" is a space-separated set of "KEY:value" modulation rate ranges
// Opt-in (see the `transform` field on mikrotik-wifi-registration) and best-effort:
// this hasn't been matched against new CAPsMAN's (/interface/wifi) field shapes at
// all, which is why it's gated to `capsman === 'old'` by the caller.
function parseRate(value) {
    if (!value) {
        return { rate: null, width: null };
    }
    const match = /^([\d.]+[a-z]+)-?(\d+[a-z]+)?/i.exec(value);
    if (!match) {
        return { rate: null, width: null };
    }
    return { rate: match[1], width: match[2] || null };
}

function parseRateSet(value) {
    const rateSet = {};
    if (!value) {
        return rateSet;
    }
    const matches = value.matchAll(/([\w]+):([\d\-\w=,]+)/g);
    for (const match of matches) {
        rateSet[match[1]] = match[2];
    }
    return rateSet;
}

function toNumberOrUndefined(value) {
    // Number('') is 0, not NaN/undefined - guard it explicitly, since an empty split
    // segment (a missing bytes/packets field) should stay "no value", not become 0.
    return value === undefined || value === '' ? undefined : Number(value);
}

module.exports = function transformOldCapsmanRow(row) {
    const [txBytes, rxBytes] = String(row.bytes || '').split(',');
    const [txPackets, rxPackets] = String(row.packets || '').split(',');
    const rxRate = parseRate(row['rx-rate']);
    const txRate = parseRate(row['tx-rate']);

    return {
        mac_address: row['mac-address'],
        ssid: row.ssid,
        comment: row.comment,
        eap_identity: row['eap-identity'],
        interface: row.interface,
        uptime: row.uptime,
        vlan_id: toNumberOrUndefined(row['vlan-id']),
        last_ip: row['last-ip'],
        rx: {
            bytes: toNumberOrUndefined(rxBytes),
            packets: toNumberOrUndefined(rxPackets),
            rate: rxRate.rate,
            width: rxRate.width,
            signal: toNumberOrUndefined(row['rx-signal'])
        },
        tx: {
            bytes: toNumberOrUndefined(txBytes),
            packets: toNumberOrUndefined(txPackets),
            rate: txRate.rate,
            width: txRate.width,
            rate_sets: parseRateSet(row['tx-rate-set'])
        }
    };
};
