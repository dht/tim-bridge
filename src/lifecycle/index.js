import { lifecycle as A_001 } from './A-001.js';
import { lifecycle as A_002 } from './A-002.js';
import { lifecycle as A_003 } from './A-003.js';
import { lifecycle as A_004 } from './A-004.js';
import { lifecycle as A_005 } from './A-005.js';
import { lifecycle as A_006 } from './A-006.js';
import { lifecycle as A_007 } from './A-007.js';
import { lifecycle as A_901 } from './A-901.js';
import {
  onBridgeClose as onBridgeCloseGeneric,
  onBridgeOpen as onBridgeOpenGeneric,
} from './_generic.js';

const all = {
  'A-001': A_001,
  'A-002': A_002,
  'A-003': A_003,
  'A-004': A_004,
  'A-005': A_005,
  'A-006': A_006,
  'A-007': A_007,
  'A-901': A_901,
};

export function normalizeId(id) {
  const parts = id.split('-');
  return `${parts[0]}-${parts[1]}`;
}

export function onBridgeOpen(instanceId, data) {
  // generic
  onBridgeOpenGeneric(instanceId, data);

  // specific
  const id = normalizeId(instanceId);
  const lifecycle = all[id];

  if (typeof lifecycle?.onBridgeOpen !== 'function') return;

  return lifecycle.onBridgeOpen(instanceId, data);
}

export function onChange(instanceId, data) {
  const id = normalizeId(instanceId);
  const lifecycle = all[id];

  if (typeof lifecycle?.onChange !== 'function') return;

  return lifecycle.onChange(instanceId, data);
}

export function onBridgeClose(instanceId, data) {
  // generic
  onBridgeCloseGeneric(instanceId, data);

  // specific
  const id = normalizeId(instanceId);
  const lifecycle = all[id];

  if (typeof lifecycle?.onBridgeClose !== 'function') return;

  return lifecycle.onBridgeClose(instanceId, data);
}

export const lifecycle = {
  onBridgeOpen,
  onChange,
  onBridgeClose,
};
