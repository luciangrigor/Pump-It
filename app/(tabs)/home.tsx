import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useBle } from '../../context/BleContext';
import { sessionHistory, Session } from './monitor';
import { getUser, loadSessions, SessionDoc } from '../../lib/appwrite';

function formatDate(d: Date): string {
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(start: Date, end: Date): string {
  const s = Math.round((end.getTime() - start.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function docToSession(doc: SessionDoc): Session {
  return {
    startTime: new Date(doc.startTime),
    endTime:   new Date(doc.endTime),
    avgHr:     doc.avgHr,
    minHr:     doc.minHr,
    maxHr:     doc.maxHr,
    avgOxy:    doc.avgOxy,
    anomalies: doc.anomalies,
  };
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const { connectedDevice, data } = useBle();
  const [userName, setUserName]   = useState('');
  const [lastSession, setLastSession] = useState<Session | null>(null);

  useFocusEffect(useCallback(() => {
    getUser().then(user => {
      if (!user) return;
      setUserName(user.name?.split(' ')[0] ?? '');
      loadSessions(user.$id)
        .then(docs => {
          // merge with in-memory, take most recent
          const persisted = docs.map(docToSession);
          const remote    = new Set(persisted.map(s => s.startTime.toISOString()));
          const local     = sessionHistory.filter(s => !remote.has(s.startTime.toISOString()));
          const all       = [...local, ...persisted];
          if (all.length > 0) setLastSession(all[0]);
        })
        .catch(() => {
          if (sessionHistory.length > 0) setLastSession(sessionHistory[sessionHistory.length - 1]);
        });
    });
  }, []));

  const connected   = !!connectedDevice;
  const hasFinger   = data.status === '3';
  const isAnalyzing = connected && (data.status === '1' || data.status === '2');

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* Greeting */}
        <View className="px-6 pt-10 pb-6">
          <Text className="text-zinc-400 text-base">{greeting()},</Text>
          <Text className="text-white text-3xl font-bold mt-1">{userName || 'Welcome'}</Text>
        </View>

        {/* Quick status */}
        <View className="px-6 mb-6">
          <Text className="text-muted text-xs uppercase tracking-widest mb-2">Status</Text>
          <View className="bg-card rounded-2xl border border-border p-4 gap-3">

            {/* Device */}
            <View className="flex-row items-center justify-between">
              <Text className="text-zinc-400 text-sm">Device</Text>
              {connected ? (
                <View className="flex-row items-center gap-2">
                  <View className="w-2 h-2 rounded-full bg-success" />
                  <Text className="text-emerald-300 text-sm font-medium">{connectedDevice.name}</Text>
                </View>
              ) : (
                <Text className="text-muted text-sm">Not connected</Text>
              )}
            </View>

            {/* Sensor */}
            <View className="flex-row items-center justify-between">
              <Text className="text-zinc-400 text-sm">Sensor</Text>
              {!connected ? (
                <Text className="text-muted text-sm">—</Text>
              ) : hasFinger ? (
                <View className="flex-row items-center gap-2">
                  <View className="w-2 h-2 rounded-full bg-success" />
                  <Text className="text-emerald-300 text-sm font-medium">Finger detected</Text>
                </View>
              ) : isAnalyzing ? (
                <View className="flex-row items-center gap-2">
                  <View className="w-2 h-2 rounded-full bg-primary-light" />
                  <Text className="text-primary-light text-sm font-medium">Analyzing…</Text>
                </View>
              ) : (
                <Text className="text-muted text-sm">No finger</Text>
              )}
            </View>

            {/* Live HR if active */}
            {hasFinger && (
              <View className="flex-row items-center justify-between">
                <Text className="text-zinc-400 text-sm">Live HR</Text>
                <Text className="text-trace text-sm font-bold">{data.hr} BPM</Text>
              </View>
            )}

          </View>
        </View>

        {/* Last session */}
        <View className="px-6">
          <Text className="text-muted text-xs uppercase tracking-widest mb-2">Last Session</Text>
          {lastSession ? (
            <View className="bg-card rounded-2xl border border-border overflow-hidden">

              <View className="flex-row justify-between items-center px-4 py-3 border-b border-border">
                <View>
                  <Text className="text-zinc-200 font-bold text-base">{formatDate(lastSession.startTime)}</Text>
                  <Text className="text-muted text-sm mt-0.5">
                    {formatTime(lastSession.startTime)} · {formatDuration(lastSession.startTime, lastSession.endTime)}
                  </Text>
                </View>
                {lastSession.anomalies > 0 ? (
                  <View className="bg-alert-bg border border-alert rounded-lg px-3 py-1">
                    <Text className="text-alert-text text-xs font-semibold">
                      {lastSession.anomalies} anomal{lastSession.anomalies !== 1 ? 'ies' : 'y'}
                    </Text>
                  </View>
                ) : (
                  <View className="bg-success-dark border border-success rounded-lg px-3 py-1">
                    <Text className="text-emerald-300 text-xs font-semibold">Normal</Text>
                  </View>
                )}
              </View>

              <View className="flex-row p-3 gap-2">
                <View className="flex-1 items-center">
                  <Text className="text-trace text-lg font-bold">{lastSession.avgHr}</Text>
                  <Text className="text-muted text-xs">BPM</Text>
                  <Text className="text-muted text-xs mt-0.5">Avg HR</Text>
                </View>
                <View className="flex-1 items-center">
                  <Text className="text-hrv text-lg font-bold">{lastSession.minHr}</Text>
                  <Text className="text-muted text-xs">BPM</Text>
                  <Text className="text-muted text-xs mt-0.5">Min HR</Text>
                </View>
                <View className="flex-1 items-center">
                  <Text className={`text-lg font-bold ${lastSession.maxHr > 100 ? 'text-warn' : 'text-hrv'}`}>{lastSession.maxHr}</Text>
                  <Text className="text-muted text-xs">BPM</Text>
                  <Text className="text-muted text-xs mt-0.5">Max HR</Text>
                </View>
                <View className="flex-1 items-center">
                  <Text className="text-blue-reading text-lg font-bold">{lastSession.avgOxy > 0 ? lastSession.avgOxy : '—'}</Text>
                  <Text className="text-muted text-xs">%</Text>
                  <Text className="text-muted text-xs mt-0.5">Avg SpO₂</Text>
                </View>
              </View>

            </View>
          ) : (
            <View className="bg-card rounded-2xl border border-border p-8 items-center">
              <Text className="text-muted text-sm text-center">
                No sessions yet.{'\n'}Place your finger on the sensor to start recording.
              </Text>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
