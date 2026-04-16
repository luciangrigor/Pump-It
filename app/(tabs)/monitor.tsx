/*
 * app/(tabs)/monitor.tsx
 *
 * Same UI as before.  Only change: subscribes to CHAR_PPG_UUID and pushes
 * samples into ppgBuffer via the appendPPG utility.
 */

import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  appendPPG,
  CHAR_HR_UUID,
  CHAR_OXY_UUID,
  CHAR_PPG_UUID,
  CHAR_STATUS_UUID,
  decodePPGSample,
  SERVICE_UUID,
  useBle,
} from '@/context/BleContext';

const Monitor = () => {
  const { connectedDevice, data, setData } = useBle();

  useEffect(() => {
    if (!connectedDevice) return;

    // ── Heart rate ────────────────────────────────────────────────────────────
    const hrSub = connectedDevice.monitorCharacteristicForService(
      SERVICE_UUID, CHAR_HR_UUID, (_err, char) => {
        if (char?.value) {
          const decoded = atob(char.value);
          setData(prev => ({ ...prev, hr: decoded }));
        }
      }
    );

    // ── SpO2 ──────────────────────────────────────────────────────────────────
    const oxySub = connectedDevice.monitorCharacteristicForService(
      SERVICE_UUID, CHAR_OXY_UUID, (_err, char) => {
        if (char?.value) {
          const decoded = atob(char.value);
          setData(prev => ({ ...prev, oxy: decoded }));
        }
      }
    );

    // ── Status ────────────────────────────────────────────────────────────────
    const statusSub = connectedDevice.monitorCharacteristicForService(
      SERVICE_UUID, CHAR_STATUS_UUID, (_err, char) => {
        if (char?.value) {
          const decoded = atob(char.value);
          setData(prev => ({ ...prev, status: decoded }));
        }
      }
    );

    // ── Raw PPG (NEW) ─────────────────────────────────────────────────────────
    const ppgSub = connectedDevice.monitorCharacteristicForService(
      SERVICE_UUID, CHAR_PPG_UUID, (_err, char) => {
        if (char?.value) {
          const sample = decodePPGSample(char.value);   // uint16 LE → number
          setData(prev => ({
            ...prev,
            ppgBuffer: appendPPG(prev.ppgBuffer, sample),
          }));
        }
      }
    );

    return () => {
      hrSub.remove();
      oxySub.remove();
      statusSub.remove();
      ppgSub.remove();
    };
  }, [connectedDevice, setData]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-10 pb-5">
        <Text className="text-white text-3xl font-bold">Monitor</Text>
        <Text className="text-zinc-300 text-xl mt-2">
          Heart Rate: <Text className="text-primary-light">{data.hr} BPM</Text>
        </Text>
        <Text className="text-zinc-300 text-xl mt-2">
          Oxygen: <Text className="text-primary-light">{data.oxy}%</Text>
        </Text>
        <Text className="text-zinc-300 text-xl mt-2">
          Status: <Text className="text-primary-light">{data.status}</Text>
        </Text>
        <Text className="text-zinc-500 text-sm mt-4">
          PPG samples buffered: {data.ppgBuffer.length}
        </Text>
        {!connectedDevice && (
          <Text className="text-red-400 mt-10">No device connected. Please go to Search.</Text>
        )}
      </View>
    </SafeAreaView>
  );
};

export default Monitor;