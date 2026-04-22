import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CHAR_HR_UUID,
  CHAR_OXY_UUID,
  CHAR_STATUS_UUID,
  SERVICE_UUID,
  useBle,
} from '@/context/BleContext';
import { getUser, saveSession } from '@/lib/appwrite';

const STATUS_LINGER_MS = 5000;

type Classification = 'normal' | 'warning' | 'alert';
type HrEvent = { hr: number; classification: Classification; reason: string; time: Date };

export type Session = {
  startTime: Date;
  endTime:   Date;
  avgHr:     number;
  minHr:     number;
  maxHr:     number;
  avgOxy:    number;
  anomalies: number;
};

export const sessionHistory: Session[] = [];

function classifyHr(hr: number, prev: number, recentHrs: number[]): { classification: Classification; reason: string } {
  if (hr > 150) return { classification: 'alert',   reason: 'Severe tachycardia' };
  if (hr < 40)  return { classification: 'alert',   reason: 'Severe bradycardia' };
  if (hr > 100) return { classification: 'warning', reason: 'Tachycardia' };
  if (hr < 50)  return { classification: 'warning', reason: 'Bradycardia' };
  if (prev > 0) {
    const jump = Math.abs(hr - prev);
    if (jump > 30) return { classification: 'alert',   reason: `Sudden jump ${jump} BPM` };
    if (jump > 20) return { classification: 'warning', reason: `Irregular +${jump} BPM` };
  }
  if (recentHrs.length >= 10) {
    const mean = recentHrs.reduce((a, b) => a + b, 0) / recentHrs.length;
    const std  = Math.sqrt(recentHrs.reduce((a, v) => a + (v - mean) ** 2, 0) / recentHrs.length);
    if (std > 15) return { classification: 'alert',   reason: `High variability (σ=${Math.round(std)})` };
    if (std > 8)  return { classification: 'warning', reason: `Elevated variability (σ=${Math.round(std)})` };
  }
  return { classification: 'normal', reason: 'Normal' };
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const Monitor = () => {
  const { connectedDevice, setConnectedDevice, data, setData } = useBle();

  const [events,        setEvents]        = useState<HrEvent[]>([]);
  const [zStats,        setZStats]        = useState({ mean: 0, std: 0 });
  const [displayStatus, setDisplayStatus] = useState<{ classification: Classification; reason: string }>({ classification: 'normal', reason: 'Normal' });

  const lingerTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevHrRef       = useRef<number>(0);
  const lastReadingRef  = useRef<{ hr: string; oxy: string }>({ hr: '—', oxy: '—' });
  const recentHrsRef    = useRef<number[]>([]);
  const sessionStartRef = useRef<Date | null>(null);
  const sessionHrsRef   = useRef<number[]>([]);
  const sessionOxysRef  = useRef<number[]>([]);
  const sessionAnomsRef = useRef<number>(0);

  // BLE subscriptions
  useEffect(() => {
    if (!connectedDevice) return;

    const disconnectSub = connectedDevice.onDisconnected(() => {
      setConnectedDevice(null);
      setData({ hr: '0', oxy: '0', status: '0' });
    });
    const hrSub = connectedDevice.monitorCharacteristicForService(
      SERVICE_UUID, CHAR_HR_UUID, (_err, char) => {
        if (!char?.value) return;
        setData(prev => ({ ...prev, hr: atob(char.value!) }));
      }
    );
    const oxySub = connectedDevice.monitorCharacteristicForService(
      SERVICE_UUID, CHAR_OXY_UUID, (_err, char) => {
        if (!char?.value) return;
        setData(prev => ({ ...prev, oxy: atob(char.value!) }));
      }
    );
    const statusSub = connectedDevice.monitorCharacteristicForService(
      SERVICE_UUID, CHAR_STATUS_UUID, (_err, char) => {
        if (!char?.value) return;
        setData(prev => ({ ...prev, status: atob(char.value!) }));
      }
    );

    return () => { disconnectSub.remove(); hrSub.remove(); oxySub.remove(); statusSub.remove(); };
  }, [connectedDevice, setConnectedDevice, setData]);

  // Process HR readings
  useEffect(() => {
    const hr = parseInt(data.hr);
    if (isNaN(hr) || hr <= 0 || data.status !== '3') return;

    if (resetTimerRef.current) { clearTimeout(resetTimerRef.current); resetTimerRef.current = null; }

    if (!sessionStartRef.current) sessionStartRef.current = new Date();
    sessionHrsRef.current.push(hr);
    const oxy = parseInt(data.oxy);
    if (!isNaN(oxy) && oxy > 0) sessionOxysRef.current.push(oxy);
    lastReadingRef.current = { hr: data.hr, oxy: data.oxy };

    recentHrsRef.current = [...recentHrsRef.current, hr].slice(-10);
    const recent = recentHrsRef.current;
    if (recent.length >= 2) {
      const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
      const std  = Math.sqrt(recent.reduce((a, v) => a + (v - mean) ** 2, 0) / recent.length);
      setZStats({ mean: Math.round(mean), std: Math.round(std) });
    }

    const { classification, reason } = classifyHr(hr, prevHrRef.current, recent);
    prevHrRef.current = hr;

    if (classification !== 'normal') {
      sessionAnomsRef.current++;
      setEvents(e => [...e.slice(-50), { hr, classification, reason, time: new Date() }]);
      if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current);
      setDisplayStatus({ classification, reason });
    } else {
      if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current);
      lingerTimerRef.current = setTimeout(() => {
        setDisplayStatus({ classification: 'normal', reason: 'Normal' });
      }, STATUS_LINGER_MS);
    }
  }, [data.hr, data.oxy, data.status]);

  // Reset on finger fully removed — 3s debounce guards against glitch packets
  useEffect(() => {
    if (data.status !== '0') {
      if (resetTimerRef.current) { clearTimeout(resetTimerRef.current); resetTimerRef.current = null; }
      return;
    }
    if (resetTimerRef.current) return;
    resetTimerRef.current = setTimeout(() => {
      resetTimerRef.current = null;

      if (sessionStartRef.current && sessionHrsRef.current.length > 0) {
        const hrs        = sessionHrsRef.current;
        const oxys       = sessionOxysRef.current;
        const startTime  = sessionStartRef.current;
        const endTime    = new Date();
        const durationMs = endTime.getTime() - startTime.getTime();

        if (durationMs >= 7000) {
          const session: Session = {
            startTime,
            endTime,
            avgHr:     Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length),
            minHr:     Math.min(...hrs),
            maxHr:     Math.max(...hrs),
            avgOxy:    oxys.length > 0 ? Math.round(oxys.reduce((a, b) => a + b, 0) / oxys.length) : 0,
            anomalies: sessionAnomsRef.current,
          };
          sessionHistory.push(session);
          getUser().then(user => {
            if (!user) return;
            saveSession({
              userId:    user.$id,
              startTime: startTime.toISOString(),
              endTime:   endTime.toISOString(),
              avgHr:     session.avgHr,
              minHr:     session.minHr,
              maxHr:     session.maxHr,
              avgOxy:    session.avgOxy,
              anomalies: session.anomalies,
            }).catch(e => console.error('saveSession failed', e));
          });
        }
      }

      sessionStartRef.current  = null;
      sessionHrsRef.current    = [];
      sessionOxysRef.current   = [];
      sessionAnomsRef.current  = 0;
      recentHrsRef.current     = [];
      lastReadingRef.current   = { hr: '—', oxy: '—' };
      prevHrRef.current        = 0;
      setEvents([]);
      setZStats({ mean: 0, std: 0 });
      setDisplayStatus({ classification: 'normal', reason: 'Normal' });
      if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current);
    }, 3000);
  }, [data.status]);

  const connected   = !!connectedDevice;
  const hasFinger   = data.status === '3';
  const isAnalyzing = connected && (data.status === '1' || data.status === '2');

  // Badge style classes derived from classification
  const badgeClasses = isAnalyzing
    ? { wrap: 'bg-filler-dark border-primary', dot: 'bg-primary-light', text: 'text-primary-light' }
    : displayStatus.classification === 'alert'
    ? { wrap: 'bg-alert-bg border-alert',       dot: 'bg-alert',        text: 'text-alert-text' }
    : displayStatus.classification === 'warning'
    ? { wrap: 'bg-warn-bg border-warn',          dot: 'bg-warn',         text: 'text-warn-text' }
    : { wrap: 'bg-success-dark border-success',  dot: 'bg-success',      text: 'text-emerald-300' };

  const badgeText = !connected ? 'No device connected' :
    isAnalyzing ? 'Object detected, analyzing…' :
    !hasFinger  ? 'Place finger on sensor' :
    displayStatus.classification === 'alert'   ? `Alert — ${displayStatus.reason}` :
    displayStatus.classification === 'warning' ? `Warning — ${displayStatus.reason}` :
    'Normal rhythm';

  const stdColor = zStats.std > 15 ? 'text-alert' : zStats.std > 8 ? 'text-warn' : 'text-hrv';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View className="px-4 pt-10 pb-4 flex-row justify-between items-center">
          <View>
            <Text className="text-white text-3xl font-bold">Monitor</Text>
            <Text className="text-zinc-400 mt-1">Live sensor readings</Text>
          </View>
          {connected && (
            <View className="flex-row items-center gap-2 px-3 py-1 rounded-full bg-success-dark border border-success">
              <View className="w-2 h-2 rounded-full bg-success" />
              <Text className="text-emerald-300 text-xs font-medium">Connected</Text>
            </View>
          )}
        </View>

        {/* Status badge */}
        <View className="px-4 mb-6">
          <View className={`flex-row items-center gap-2 px-4 py-3 rounded-xl border ${badgeClasses.wrap}`}>
            <View className={`w-2 h-2 rounded-full ${badgeClasses.dot}`} />
            <Text className={`font-semibold ${badgeClasses.text}`}>{badgeText}</Text>
          </View>
        </View>

        {/* HR and SpO2 big cards */}
        <View className="px-4 flex-row gap-4">
          <View className="flex-1 bg-card rounded-2xl border border-border p-6 items-center">
            <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-2">Heart Rate</Text>
            <Text className="text-trace text-6xl font-extrabold">
              {hasFinger ? lastReadingRef.current.hr : '—'}
            </Text>
            <Text className="text-muted text-sm mt-1">BPM</Text>
          </View>

          <View className="flex-1 bg-card rounded-2xl border border-border p-6 items-center">
            <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-2">SpO₂</Text>
            <Text className="text-blue-reading text-6xl font-extrabold">
              {hasFinger ? lastReadingRef.current.oxy : '—'}
            </Text>
            <Text className="text-muted text-sm mt-1">%</Text>
          </View>
        </View>

        {/* Z-score stats row */}
        <View className="px-4 mt-4 flex-row gap-3">
          <View className="flex-1 bg-card rounded-xl border border-border p-3 items-center">
            <Text className="text-hrv text-xl font-bold">{hasFinger ? zStats.mean : '—'}</Text>
            <Text className="text-muted text-xs mt-1">BPM</Text>
            <Text className="text-muted text-xs mt-1">Mean</Text>
          </View>
          <View className="flex-1 bg-card rounded-xl border border-border p-3 items-center">
            <Text className={`text-xl font-bold ${hasFinger ? stdColor : 'text-muted'}`}>
              {hasFinger ? zStats.std : '—'}
            </Text>
            <Text className="text-muted text-xs mt-1">σ</Text>
            <Text className="text-muted text-xs mt-1">Std Dev</Text>
          </View>
          <View className="flex-1 bg-card rounded-xl border border-border p-3 items-center">
            <Text className="text-warn text-xl font-bold">{hasFinger ? events.length : '—'}</Text>
            <Text className="text-muted text-xs mt-1">total</Text>
            <Text className="text-muted text-xs mt-1">Anomalies</Text>
          </View>
        </View>

        {/* Anomaly log */}
        <View className="px-4 mt-6">
          <Text className="text-muted text-xs uppercase tracking-widest mb-2 px-1">Anomaly log</Text>
          <View className="bg-card rounded-xl border border-border overflow-hidden">
            <View className="flex-row px-4 py-2 border-b border-border">
              {['HR', 'Class', 'Reason', 'Time'].map(h => (
                <Text key={h} className={`text-muted text-xs uppercase tracking-wide ${h === 'Reason' ? 'flex-2' : 'flex-1'}`}>{h}</Text>
              ))}
            </View>
            {events.length === 0 ? (
              <View className="p-6 items-center">
                <Text className="text-muted">No anomalies detected</Text>
              </View>
            ) : (
              [...events].reverse().slice(0, 10).map((e, i) => (
                <View
                  key={i}
                  className={`flex-row px-4 py-3 ${i < 9 ? 'border-b border-border' : ''} ${e.classification === 'alert' ? 'bg-alert-bg/30' : 'bg-warn-bg/30'}`}
                >
                  <Text className="flex-1 text-muted text-sm">{e.hr}</Text>
                  <Text className={`flex-1 text-sm font-semibold ${e.classification === 'alert' ? 'text-alert' : 'text-warn'}`}>
                    {e.classification.charAt(0).toUpperCase() + e.classification.slice(1)}
                  </Text>
                  <Text className="flex-2 text-muted text-xs">{e.reason}</Text>
                  <Text className="flex-1 text-muted text-xs">{formatTime(e.time)}</Text>
                </View>
              ))
            )}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default Monitor;
