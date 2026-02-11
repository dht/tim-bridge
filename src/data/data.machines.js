export const MACHINES_DEV = {
  'A-001-dev': {
    id: 'A-001-dev',
    name: 'Houses',
  },
  'A-002-dev': {
    id: 'A-002-dev',
    name: '2084',
  },
  'X-001-dev': {
    id: 'X-001-dev',
    name: 'Homosapiens',
  },
  'A-004-dev': {
    id: 'A-004-dev',
    name: 'Arm',
  },
  'A-005-dev': {
    id: 'A-005-dev',
    name: 'Haiku',
  },
  'A-006-dev': {
    id: 'A-006-dev',
    name: 'Queens',
  },
  'A-007-dev': {
    id: 'A-007-dev',
    name: 'Coffeeshop',
  },
  'S-001-dev': {
    id: 'S-001-dev',
    name: 'Claygon',
  },
};

export const MACHINES_PROD = {
  'A-001-miffal': {
    id: 'A-001-miffal',
    name: 'Houses',
  },
  'S-001-miffal': {
    id: 'S-001-miffal',
    name: 'Claygon',
  },
};

export const MACHINES = {
  ...MACHINES_DEV,
  ...MACHINES_PROD,
};

export const MACHINE_IDS = Object.keys(MACHINES);
