window.NARUTO_SIM_PROFILES = [
    {
        id: 'bebop', displayName: 'Bebop Drone', startString: 'BebopDrone-', endString: 'LNNNNNN',
        macPrefixes: ['903AE6', '00121C', '9003B7', 'A0143D', '00267E'],
        // RF ghost-track family: confidence MUST stay < 0.5 (zero-trust isolation, claim C-013)
        ghost: { confidenceRange: [0.2, 0.35], lifetimeMs: [6000, 9000], speed: 9.0, spoofWindow: { onMs: 3000, offMs: 2000 } }
    },
    {
        id: 'dji-test', displayName: 'DJI Test', startString: 'DJITEST-', endString: 'AAAAAAAA',
        macPrefixes: ['481CB9', '60601F', 'E47A2C', '34D262', 'F41A79'],
        ghost: { confidenceRange: [0.3, 0.49], lifetimeMs: [8000, 12000], speed: 15.0, spoofWindow: { onMs: 4000, offMs: 4000 } }
    }
];
