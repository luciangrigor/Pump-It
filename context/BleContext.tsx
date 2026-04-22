import React, { createContext, useContext, useState } from 'react';
import { Device } from 'react-native-ble-plx';

export const SERVICE_UUID     = 'e3b8e649-fb8a-45eb-a81b-d05d8c96681e';
export const CHAR_HR_UUID     = 'cf19a6c7-c16d-47c3-bfd9-4a1020bb79e4';
export const CHAR_OXY_UUID    = 'cf19a6c7-c16d-47c3-bfd9-4a1020bb79e5';
export const CHAR_STATUS_UUID = 'cf19a6c7-c16d-47c3-bfd9-4a1020bb79e6';

export type BleData = {
  hr:     string;
  oxy:    string;
  status: string; // 0=no object, 1=object detected, 2=finger detected, 3=finger OK
};

type BleContextType = {
  connectedDevice:    Device | null;
  setConnectedDevice: (d: Device | null) => void;
  data:    BleData;
  setData: React.Dispatch<React.SetStateAction<BleData>>;
};

const BleContext = createContext<BleContextType>({
  connectedDevice:    null,
  setConnectedDevice: () => {},
  data: { hr: '—', oxy: '—', status: '0' },
  setData: () => {},
});

export const BleProvider = ({ children }: { children: React.ReactNode }) => {
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [data, setData] = useState<BleData>({ hr: '—', oxy: '—', status: '0' });

  return (
    <BleContext.Provider value={{ connectedDevice, setConnectedDevice, data, setData }}>
      {children}
    </BleContext.Provider>
  );
};

export const useBle = () => useContext(BleContext);
