/*
 * context/BleContext.tsx
 *
 * Additions vs original:
 *   – ppgBuffer: number[]  rolling ring of raw IR samples (max 500 points)
 *   – CHAR_PPG_UUID        fourth characteristic (raw waveform, 25 Hz)
 *   – monitorPPG()         subscribes to PPG notify and decodes uint16 LE
 */

import React, { createContext, useContext, useState } from 'react';
import { Device } from 'react-native-ble-plx';

// ── UUIDs ─────────────────────────────────────────────────────────────────────
export const SERVICE_UUID     = 'e3b8e649-fb8a-45eb-a81b-d05d8c96681e';
export const CHAR_HR_UUID     = 'cf19a6c7-c16d-47c3-bfd9-4a1020bb79e4';
export const CHAR_OXY_UUID    = 'cf19a6c7-c16d-47c3-bfd9-4a1020bb79e5';
export const CHAR_STATUS_UUID = 'cf19a6c7-c16d-47c3-bfd9-4a1020bb79e6';
export const CHAR_PPG_UUID    = 'cf19a6c7-c16d-47c3-bfd9-4a1020bb79e7'; // NEW

// ── PPG ring buffer size (10 s at 25 Hz = 250; keep 500 for the chart) ────────
const PPG_BUFFER_MAX = 500;

// ── Types ─────────────────────────────────────────────────────────────────────
export type BleData = {
  hr:        string;
  oxy:       string;
  status:    string;
  ppgBuffer: number[];   // NEW – raw IR values, newest last
};

type BleContextType = {
  connectedDevice: Device | null;
  setConnectedDevice: (d: Device | null) => void;
  data:    BleData;
  setData: React.Dispatch<React.SetStateAction<BleData>>;
};

// ── Context ───────────────────────────────────────────────────────────────────
const BleContext = createContext<BleContextType>({
  connectedDevice:    null,
  setConnectedDevice: () => {},
  data: { hr: '—', oxy: '—', status: '—', ppgBuffer: [] },
  setData: () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────
export const BleProvider = ({ children }: { children: React.ReactNode }) => {
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [data, setData] = useState<BleData>({
    hr:        '—',
    oxy:       '—',
    status:    '—',
    ppgBuffer: [],
  });

  return (
    <BleContext.Provider value={{ connectedDevice, setConnectedDevice, data, setData }}>
      {children}
    </BleContext.Provider>
  );
};

export const useBle = () => useContext(BleContext);

// ── Utility: decode uint16 little-endian from base64 BLE notify ───────────────
// The ESP32 sends 2 raw bytes. BLE-PLX hands them back as a base64 string.
export function decodePPGSample(b64: string): number {
  const binary = atob(b64);
  const lo = binary.charCodeAt(0);
  const hi = binary.charCodeAt(1);
  return lo | (hi << 8);          // uint16 LE → JS number (0–65535)
}

// ── Utility: append to ring buffer (mutates for performance) ──────────────────
export function appendPPG(buffer: number[], sample: number): number[] {
  const next = buffer.length >= PPG_BUFFER_MAX
    ? buffer.slice(buffer.length - PPG_BUFFER_MAX + 1)
    : buffer.slice();
  next.push(sample);
  return next;
}