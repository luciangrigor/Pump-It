import React, { useCallback, useEffect, useState } from 'react';
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
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

const Charts = () => {
  const { data } = useBle();
  const [persisted, setPersisted] = useState<Session[]>([]);

  const fetchSessions = useCallback(() => {
    getUser().then(user => {
      if (!user) return;
      loadSessions(user.$id)
        .then(docs => setPersisted(docs.map(docToSession)))
        .catch(e => console.error('loadSessions failed', e));
    });
  }, []);

  useFocusEffect(useCallback(() => { fetchSessions(); }, [fetchSessions]));

  useEffect(() => {
    if (data.status === '0') fetchSessions();
  }, [data.status, fetchSessions]);

  const remote   = new Set(persisted.map(s => s.startTime.toISOString()));
  const local    = sessionHistory.filter(s => !remote.has(s.startTime.toISOString()));
  const sessions = [...local, ...persisted];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View className="px-4 pt-10 pb-4">
          <Text className="text-white text-3xl font-bold">History</Text>
          <Text className="text-zinc-400 mt-1">{sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded</Text>
        </View>

        {sessions.length === 0 ? (
          <View className="p-12 items-center">
            <Text className="text-muted text-sm text-center">
              No sessions yet.{'\n'}Place your finger on the sensor to start recording.
            </Text>
          </View>
        ) : (
          sessions.map((s: Session, i) => (
            <View key={i} className="px-4 mb-3">
              <View className="bg-card rounded-2xl border border-border overflow-hidden">

                {/* Session header */}
                <View className="flex-row justify-between items-center px-4 py-3 border-b border-border">
                  <View>
                    <Text className="text-zinc-200 font-bold text-base">
                      {formatDate(s.startTime)}
                    </Text>
                    <Text className="text-muted text-sm mt-0.5">
                      {formatTime(s.startTime)} · {formatDuration(s.startTime, s.endTime)}
                    </Text>
                  </View>
                  {s.anomalies > 0 ? (
                    <View className="bg-alert-bg border border-alert rounded-lg px-3 py-1">
                      <Text className="text-alert-text text-xs font-semibold">
                        {s.anomalies} anomal{s.anomalies !== 1 ? 'ies' : 'y'}
                      </Text>
                    </View>
                  ) : (
                    <View className="bg-success-dark border border-success rounded-lg px-3 py-1">
                      <Text className="text-emerald-300 text-xs font-semibold">Normal</Text>
                    </View>
                  )}
                </View>

                {/* Stats grid */}
                <View className="flex-row p-3 gap-2">
                  <View className="flex-1 items-center">
                    <Text className="text-trace text-lg font-bold">{s.avgHr}</Text>
                    <Text className="text-muted text-xs">BPM</Text>
                    <Text className="text-muted text-xs mt-0.5">Avg HR</Text>
                  </View>
                  <View className="flex-1 items-center">
                    <Text className="text-hrv text-lg font-bold">{s.minHr}</Text>
                    <Text className="text-muted text-xs">BPM</Text>
                    <Text className="text-muted text-xs mt-0.5">Min HR</Text>
                  </View>
                  <View className="flex-1 items-center">
                    <Text className={`text-lg font-bold ${s.maxHr > 100 ? 'text-warn' : 'text-hrv'}`}>{s.maxHr}</Text>
                    <Text className="text-muted text-xs">BPM</Text>
                    <Text className="text-muted text-xs mt-0.5">Max HR</Text>
                  </View>
                  <View className="flex-1 items-center">
                    <Text className="text-blue-reading text-lg font-bold">{s.avgOxy > 0 ? s.avgOxy : '—'}</Text>
                    <Text className="text-muted text-xs">%</Text>
                    <Text className="text-muted text-xs mt-0.5">Avg SpO₂</Text>
                  </View>
                </View>

              </View>
            </View>
          ))
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

export default Charts;
