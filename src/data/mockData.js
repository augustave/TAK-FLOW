export const fallbackDecoyProfiles = [
    { id: 'bebop', displayName: 'Bebop Drone', startString: 'BebopDrone-', endString: 'LNNNNNN', macPrefixes: ['903AE6', '00121C', '9003B7', 'A0143D', '00267E'] },
    { id: 'dji-test', displayName: 'DJI Test', startString: 'DJITEST-', endString: 'AAAAAAAA', macPrefixes: ['481CB9', '60601F', 'E47A2C', '34D262', 'F41A79'] }
];

export const sources = ['MTI-GEO', 'SAR-SAT', 'HUMINT', 'ELINT-ESM', 'VISUAL-EO'];
export const confidences = ['HIGH', 'MEDIUM', 'LOW'];

const types = ['hostile', 'friendly', 'unknown'];
const subtypes = {
    hostile: ['ARMOR', 'MECH INF', 'ADA', 'MLRS', 'LOG', 'C2', 'UAS SWARM', 'XLUUV_ORCA', 'LUUV_SNAKEHEAD', 'MUUV_KNIFEFISH', 'SUUV_SANDSHARK'],
    friendly: ['MEU', 'CAV', 'SOF', 'FIRES', 'UAS SWARM', 'XLUUV_ORCA', 'MUUV_KNIFEFISH'],
    unknown: ['CONVOY', 'ROTARY', 'CIV', 'UAS SWARM', 'SUUV_SANDSHARK']
};

export const trackData = [];

export function loadScenario(profile = 'swarm') {
    trackData.length = 0;
    
    trackData.push(
        { id: 'TK-4071', type: 'hostile', subtype: 'ARMOR', x: -12, y: 8, spd: 22, threat_level: 'HIGH', time_to_event_seconds: 45 },
        { id: 'TK-4072', type: 'hostile', subtype: 'MECH INF', x: 15, y: -5, spd: 35, threat_level: 'HIGH', time_to_event_seconds: 120 },
        { id: 'TK-4073', type: 'hostile', subtype: 'ADA', x: -5, y: -18, spd: 0, threat_level: 'HIGH', time_to_event_seconds: 300 },
        { id: 'TK-4074', type: 'hostile', subtype: 'MLRS', x: 18, y: 12, spd: 0, threat_level: 'HIGH', time_to_event_seconds: 20 },
        { id: 'BF-1001', type: 'friendly', subtype: 'MEU', x: -8, y: 20, spd: 15, threat_level: 'LOW', time_to_event_seconds: 999 },
        { id: 'UK-7001', type: 'unknown', subtype: 'CONVOY', x: 25, y: -15, spd: 55, threat_level: 'MEDIUM', time_to_event_seconds: 300 },
        { id: 'ORCA-H1', type: 'hostile', subtype: 'XLUUV_ORCA', x: 30, y: -20, spd: 8, threat_level: 'HIGH', time_to_event_seconds: 600 },
        { id: 'ORCA-H2', type: 'hostile', subtype: 'XLUUV_ORCA', x: 32, y: -18, spd: 8, threat_level: 'HIGH', time_to_event_seconds: 600 },
        { id: 'SNAKE-1', type: 'hostile', subtype: 'LUUV_SNAKEHEAD', x: -25, y: 15, spd: 10, threat_level: 'HIGH', time_to_event_seconds: 400 },
        { id: 'SHARK-1', type: 'unknown', subtype: 'SUUV_SANDSHARK', x: 0, y: 30, spd: 5, threat_level: 'MEDIUM', time_to_event_seconds: 800 }
    );

    let count = 1500;
    let distFriendly = 0.55;
    let distHostile = 0.10;
    
    if (profile === 'patrol') { count = 150; distFriendly = 0.80; distHostile = 0.05; }
    else if (profile === 'symmetric') { count = 800; distFriendly = 0.45; distHostile = 0.45; }

    for (let i = 0; i < count; i++) {
        const r = Math.random();
        const type = r > distFriendly ? 'friendly' : (r > distHostile ? 'hostile' : 'unknown');
        const st = subtypes[type];
        const subtype = st[Math.floor(Math.random() * st.length)];
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 40;
        
        let threat = 'LOW';
        if (type === 'hostile') threat = 'HIGH';
        else if (type === 'unknown') threat = 'MEDIUM';
        
        trackData.push({
            id: `SW-${1000 + i}`,
            type: type,
            subtype: subtype,
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
            spd: Math.random() * 120,
            threat_level: threat,
            time_to_event_seconds: Math.floor(Math.random() * 600) + 15
        });
    }
}

// Initial default
loadScenario('swarm');

export const sigintMessages = [
    { tag: 'intel', text: 'INTERCEPT: TK-4074 MLRS battery emitting targeting radar — potential fire mission imminent' },
    { tag: 'warn', text: 'SA-17 TELAR ACTIVE — tracking on azimuth 247° — possible engagement sequence' },
    { tag: 'crit', text: 'FLASH: NEW EMITTER DETECTED grid 38TLN 05100 17200 — assessing as EW JAMMING NODE' },
    { tag: 'info', text: 'BF-1002 REPORTS: visual contact 3× wheeled vehicles moving NE along MSR DELTA' },
    { tag: 'intel', text: 'SIGINT CUT: TK-4071 C2 node transmitting encrypted burst — duration 4.2 sec' },
    { tag: 'warn', text: 'MTI: 6 movers departing grid 38TLN 04500 16800 — heading 045° / est 35 kph' },
    { tag: 'info', text: 'BF-1003 SOF TEAM: eyes on objective CEDAR — 2× sentries, 1× technical parked south side' },
    { tag: 'crit', text: 'PRIORITY: UK-7001 CONVOY assessed HOSTILE — thermal signature consistent w/ T-72 column' },
    { tag: 'intel', text: 'ELINT: VHF comms spike across AOR — possible coordination for counter-attack' },
    { tag: 'warn', text: 'NOTAM: ROZ-BRAVO extended to 2200Z — all friendly air re-route via CP WHISKEY' },
    { tag: 'info', text: 'REAPER 31: FUEL STATE BINGO-30 — request tanker or relief on station' },
    { tag: 'crit', text: 'JSTARS: MASSIVE SWARM DETECTED — 1000+ UAS signatures launching across AOR' },
    { tag: 'intel', text: 'HUMINT RPT: civilian evacuation corridor compromised — IED activity grid 38TLN 04900 17100' },
    { tag: 'warn', text: 'AAA BELT assessed active — ZSU-23 positions along ridgeline BRAVO' },
    { tag: 'info', text: 'BF-1004 FIRES: M142 READY — TGT LIST UPDATED — 3 priority targets in queue' }
];
