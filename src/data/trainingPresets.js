import { fallbackDecoyProfiles } from './mockData.js';

// Instructor training presets: a preset composes an existing scenario profile,
// an EW-zone lay-down (worker SET_EW_ZONES), and an optional decoy family.
// Everything a preset arms is an already-verified capability; presets add no
// new simulation mechanics.

export const trainingPresets = [
    {
        id: 'EW-DEGRADED-LITTORAL',
        label: 'EW-DEGRADED LITTORAL',
        description: 'Massed swarm under a widened littoral jamming band; EMCON discipline drill.',
        scenarioProfile: 'swarm',
        ewZones: [{ x: 0, y: 0, radius: 25 }],
        decoy: { profileId: 'bebop', count: 6 }
    },
    {
        id: 'GHOST-DISCRIMINATION-DRILL',
        label: 'GHOST DISCRIMINATION DRILL',
        description: 'Patrol picture salted with DJI-family spoof bursts; operators must refuse ghost designations.',
        scenarioProfile: 'patrol',
        ewZones: [{ x: 0, y: 0, radius: 10 }],
        decoy: { profileId: 'dji-test', count: 12 }
    },
    {
        id: 'SWARM-FRACTURE-WATCH',
        label: 'SWARM FRACTURE WATCH',
        description: 'Symmetric force lay-down tuned for advisory-gate onset observation.',
        scenarioProfile: 'symmetric',
        ewZones: [{ x: 0, y: 0, radius: 10 }],
        decoy: null
    }
];

export function getTrainingPreset(id) {
    return trainingPresets.find((preset) => preset.id === id) || null;
}

export function resolveDecoyProfile(profileId) {
    const profiles = (typeof window !== 'undefined'
        && Array.isArray(window.NARUTO_SIM_PROFILES)
        && window.NARUTO_SIM_PROFILES.length > 0)
        ? window.NARUTO_SIM_PROFILES
        : fallbackDecoyProfiles;
    return profiles.find((profile) => profile.id === profileId) || null;
}
