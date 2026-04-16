/*
 * app/(tabs)/charts.tsx
 *
 * EKG-style waveform with real-time anomaly detection.
 *
 * Stack used:
 *   react-native-svg  – scrolling waveform path + anomaly markers
 *   (no heavy ML library needed; anomaly detection runs in JS)
 *
 * Install if not already present:
 *   npx expo install react-native-svg
 *
 * ── Anomaly detection algorithm ───────────────────────────────────────────────
 *
 *  1. Peak detection  (simplified Pan-Tompkins style)
 *     • Compute a 5-sample rolling mean as baseline.
 *     • A sample is a "peak candidate" if it exceeds baseline × PEAK_FACTOR.
 *     • Enforce a refractory period of MIN_RR_MS so we don't double-count.
 *
 *  2. RR interval analysis
 *     • Collect last N peaks → compute RR intervals (ms between peaks).
 *     • RMSSD  = sqrt( mean( (RR[i] - RR[i-1])² ) )  → HRV short-term
 *     • SDNN   = std-dev of all RR intervals           → HRV overall
 *
 *  3. Modified Z-score on each new RR interval
 *     • Uses median + MAD (robust vs outliers) instead of mean + σ.
 *     • |Z| > Z_THRESHOLD → flag that beat as anomalous.
 *
 *  4. Waveform amplitude Z-score
 *     • Each raw sample is compared to a 50-sample rolling mean/std.
 *     • Large positive or negative spikes are flagged as motion artefacts.
 *
 *  5. Final classification per beat:
 *     Normal   – Z ≤ 2.5
 *     Warning  – 2.5 < Z ≤ 4.0   (irregular interval)
 *     Alert    – Z > 4.0          (significant arrhythmia candidate)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useBle } from '../../context/BleContext';

// ─── Layout ───────────────────────────────────────────────────────────────────
const SCREEN_W   = Dimensions.get('window').width;
const CHART_H    = 200;          // SVG height for waveform
const VISIBLE_W  = SCREEN_W - 32;
const POINTS_VISIBLE = 200;     // samples shown at once
const PX_PER_PT  = VISIBLE_W / POINTS_VISIBLE;

// ─── Algorithm constants ───────────────────────────────────────────────────────
const SAMPLE_RATE_HZ = 25;
const MS_PER_SAMPLE  = 1000 / SAMPLE_RATE_HZ;   // 40 ms
const PEAK_FACTOR    = 1.15;    // sample must be 15 % above rolling mean
const MIN_RR_MS      = 300;     // 200 BPM max → 300 ms minimum RR
const MIN_RR_SAMPLES = Math.round(MIN_RR_MS / MS_PER_SAMPLE);
const Z_WARNING      = 2.5;
const Z_ALERT        = 4.0;
const RR_WINDOW      = 20;      // RR intervals kept for HRV stats
const AMP_WINDOW     = 50;      // samples for amplitude rolling stats

// ── Colours matching NativeWind theme ─────────────────────────────────────────
const C = {
  bg:        '#0e1317',
  grid:      '#1f2937',
  trace:     '#ec4899',   // primary-light pink
  traceGood: '#ec4899',
  warn:      '#f59e0b',
  alert:     '#ef4444',
  text:      '#d4d4d8',
  muted:     '#52525b',
  hrv:       '#34d399',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Classification = 'normal' | 'warning' | 'alert';
type AnomalyEvent   = { sampleIdx: number; classification: Classification; z: number };
type PeakEvent      = { sampleIdx: number; rrMs: number; z: number; classification: Classification };

// ─── Utility functions ────────────────────────────────────────────────────────

function rollingMean(buf: number[], window: number): number {
  const slice = buf.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / (slice.length || 1);
}

function rollingStd(buf: number[], window: number, mean?: number): number {
  const slice = buf.slice(-window);
  const m = mean ?? rollingMean(buf, window);
  const variance = slice.reduce((a, b) => a + (b - m) ** 2, 0) / (slice.length || 1);
  return Math.sqrt(variance);
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mad(arr: number[], med: number): number {
  const deviations = arr.map(v => Math.abs(v - med));
  return median(deviations);
}

// Modified Z-score (Iglewicz & Hoaglin, 1993)
function modifiedZ(value: number, med: number, madVal: number): number {
  if (madVal === 0) return 0;
  return (0.6745 * (value - med)) / madVal;
}

function rmssd(rrs: number[]): number {
  if (rrs.length < 2) return 0;
  const diffs = rrs.slice(1).map((r, i) => (r - rrs[i]) ** 2);
  return Math.sqrt(diffs.reduce((a, b) => a + b, 0) / diffs.length);
}

function sdnn(rrs: number[]): number {
  if (rrs.length < 2) return 0;
  const m = rrs.reduce((a, b) => a + b, 0) / rrs.length;
  return Math.sqrt(rrs.reduce((a, r) => a + (r - m) ** 2, 0) / rrs.length);
}

function classifyZ(absZ: number): Classification {
  if (absZ > Z_ALERT)   return 'alert';
  if (absZ > Z_WARNING) return 'warning';
  return 'normal';
}

function colorForClass(c: Classification) {
  return c === 'alert' ? C.alert : c === 'warning' ? C.warn : C.traceGood;
}

// ─── Normalize buffer to [0, 1] for display ───────────────────────────────────
function normalizeBuffer(buf: number[]): number[] {
  if (buf.length === 0) return [];
  const min = Math.min(...buf);
  const max = Math.max(...buf);
  const range = max - min || 1;
  return buf.map(v => (v - min) / range);
}

// ─── Build SVG path string from normalised [0,1] values ──────────────────────
function buildPath(
  normalised: number[],
  offsetX: number,
  chartH: number,
  pxPerPt: number,
  padding: number = 16,
): string {
  if (normalised.length === 0) return '';
  const usable = chartH - padding * 2;
  let d = '';
  normalised.forEach((v, i) => {
    const x = offsetX + i * pxPerPt;
    const y = padding + (1 - v) * usable;
    d += i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : ` L${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return d;
}

// ─── Component ────────────────────────────────────────────────────────────────
const Charts = () => {
  const { data } = useBle();

  // ── Anomaly engine state (refs for perf; doesn't need to trigger render) ────
  const sampleCountRef     = useRef(0);
  const lastPeakIdxRef     = useRef(-MIN_RR_SAMPLES);
  const rrIntervalsRef     = useRef<number[]>([]);   // last RR_WINDOW RR values
  const ampWindowRef       = useRef<number[]>([]);   // last AMP_WINDOW raw values

  // ── Display state ────────────────────────────────────────────────────────────
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [peaks,     setPeaks]     = useState<PeakEvent[]>([]);
  const [hrvStats,  setHrvStats]  = useState({ rmssd: 0, sdnn: 0, bpm: 0 });
  const [paused,    setPaused]    = useState(false);
  const [frozenBuf, setFrozenBuf] = useState<number[]>([]);

  const prevLenRef = useRef(0);

  // ── Run anomaly engine whenever ppgBuffer grows ───────────────────────────
  useEffect(() => {
    if (paused) return;
    const buf = data.ppgBuffer;
    if (buf.length <= prevLenRef.current) return;

    const newSamples = buf.slice(prevLenRef.current);
    prevLenRef.current = buf.length;

    const newAnomalies: AnomalyEvent[] = [];
    const newPeaks:     PeakEvent[]    = [];

    newSamples.forEach((sample, localIdx) => {
      const globalIdx = buf.length - newSamples.length + localIdx;
      sampleCountRef.current++;

      // ── Rolling amplitude window ───────────────────────────────────────────
      ampWindowRef.current.push(sample);
      if (ampWindowRef.current.length > AMP_WINDOW) ampWindowRef.current.shift();

      const ampMean = rollingMean(ampWindowRef.current, AMP_WINDOW);
      const ampStd  = rollingStd(ampWindowRef.current, AMP_WINDOW, ampMean);
      const ampZ    = ampStd > 0 ? Math.abs((sample - ampMean) / ampStd) : 0;

      // Flag amplitude artefacts (motion noise spikes)
      if (ampZ > Z_ALERT) {
        newAnomalies.push({ sampleIdx: globalIdx, classification: 'alert', z: ampZ });
      } else if (ampZ > Z_WARNING) {
        newAnomalies.push({ sampleIdx: globalIdx, classification: 'warning', z: ampZ });
      }

      // ── Peak detection ────────────────────────────────────────────────────
      const refractory = globalIdx - lastPeakIdxRef.current >= MIN_RR_SAMPLES;
      const isPeak     = refractory && sample > ampMean * PEAK_FACTOR && ampMean > 0;

      if (isPeak) {
        const rrSamples = globalIdx - lastPeakIdxRef.current;
        const rrMs      = rrSamples * MS_PER_SAMPLE;

        lastPeakIdxRef.current = globalIdx;
        rrIntervalsRef.current.push(rrMs);
        if (rrIntervalsRef.current.length > RR_WINDOW) rrIntervalsRef.current.shift();

        // RR anomaly score (modified Z-score on recent RR distribution)
        const rrs = rrIntervalsRef.current;
        const med  = median(rrs);
        const m    = mad(rrs, med);
        const z    = Math.abs(modifiedZ(rrMs, med, m));
        const cls  = classifyZ(z);

        const bpm = rrs.length > 0
          ? Math.round(60000 / (rrs.reduce((a, b) => a + b, 0) / rrs.length))
          : 0;

        newPeaks.push({ sampleIdx: globalIdx, rrMs, z, classification: cls });

        // Update HRV stats every 5 beats
        if (rrs.length >= 5) {
          setHrvStats({
            rmssd: Math.round(rmssd(rrs)),
            sdnn:  Math.round(sdnn(rrs)),
            bpm,
          });
        }
      }
    });

    if (newAnomalies.length > 0) {
      setAnomalies(prev => [...prev.slice(-200), ...newAnomalies]);
    }
    if (newPeaks.length > 0) {
      setPeaks(prev => [...prev.slice(-100), ...newPeaks]);
    }
  }, [data.ppgBuffer, paused]);

  // ── Pause/resume ──────────────────────────────────────────────────────────
  const togglePause = useCallback(() => {
    if (!paused) setFrozenBuf([...data.ppgBuffer]);
    setPaused(p => !p);
  }, [paused, data.ppgBuffer]);

  // ── Displayed buffer (frozen or live) ────────────────────────────────────
  const displayBuf = paused ? frozenBuf : data.ppgBuffer;

  // ── Slice to visible window ───────────────────────────────────────────────
  const visibleRaw  = useMemo(
    () => displayBuf.slice(-POINTS_VISIBLE),
    [displayBuf]
  );
  const visibleNorm = useMemo(() => normalizeBuffer(visibleRaw), [visibleRaw]);

  // ── Map global anomaly/peak indices → visible-window indices ─────────────
  const visibleStart = displayBuf.length - visibleRaw.length;

  const visibleAnomalies = useMemo(
    () => anomalies
      .filter(a => a.sampleIdx >= visibleStart)
      .map(a => ({ ...a, localIdx: a.sampleIdx - visibleStart })),
    [anomalies, visibleStart]
  );

  const visiblePeaks = useMemo(
    () => peaks
      .filter(p => p.sampleIdx >= visibleStart)
      .map(p => ({ ...p, localIdx: p.sampleIdx - visibleStart })),
    [peaks, visibleStart]
  );

  // ── Last anomaly for status badge ─────────────────────────────────────────
  const latestAnomaly = peaks.length > 0 ? peaks[peaks.length - 1] : null;
  const status: Classification = latestAnomaly?.classification ?? 'normal';

  // ── Build trace path ──────────────────────────────────────────────────────
  const tracePath = useMemo(
    () => buildPath(visibleNorm, 0, CHART_H, PX_PER_PT),
    [visibleNorm]
  );

  const noDevice  = data.ppgBuffer.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View className="px-4 pt-10 pb-4 flex-row justify-between items-center">
          <View>
            <Text className="text-white text-3xl font-bold">EKG</Text>
            <Text className="text-zinc-400 mt-1">Real-time waveform</Text>
          </View>
          <TouchableOpacity
            onPress={togglePause}
            className={`px-4 py-2 rounded-xl border ${paused ? 'bg-primary border-primary-light' : 'bg-filler-dark border-filler-light'}`}
          >
            <Text className={paused ? 'text-white font-bold' : 'text-zinc-400'}>
              {paused ? '▶ Resume' : '⏸ Pause'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Status badge ────────────────────────────────────────────────── */}
        <View className="px-4 mb-3">
          <View style={{
            backgroundColor:
              status === 'alert'   ? '#450a0a' :
              status === 'warning' ? '#451a03' : '#052e16',
            borderColor:
              status === 'alert'   ? '#ef4444' :
              status === 'warning' ? '#f59e0b' : '#16a34a',
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
            <View style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor:
                status === 'alert'   ? '#ef4444' :
                status === 'warning' ? '#f59e0b' : '#22c55e',
            }} />
            <Text style={{
              color:
                status === 'alert'   ? '#fca5a5' :
                status === 'warning' ? '#fcd34d' : '#86efac',
              fontWeight: '600',
            }}>
              {status === 'alert'   ? 'Alert – Irregular rhythm detected' :
               status === 'warning' ? 'Warning – Minor irregularity' :
               noDevice             ? 'No device connected' : 'Normal rhythm'}
            </Text>
          </View>
        </View>

        {/* ── Waveform ─────────────────────────────────────────────────────── */}
        <View style={{ marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: C.bg, borderWidth: 1, borderColor: '#1f2937' }}>
          <Svg width={VISIBLE_W} height={CHART_H}>

            {/* Horizontal grid lines */}
            {[0.25, 0.5, 0.75].map(fraction => {
              const y = CHART_H * fraction;
              return (
                <Line key={fraction} x1={0} y1={y} x2={VISIBLE_W} y2={y}
                  stroke={C.grid} strokeWidth={0.5} />
              );
            })}

            {/* Anomaly background tint (amplitude spikes) */}
            {visibleAnomalies.map((a, i) => (
              <Rect
                key={i}
                x={a.localIdx * PX_PER_PT - 4}
                y={0}
                width={8}
                height={CHART_H}
                fill={a.classification === 'alert' ? '#ef444422' : '#f59e0b22'}
              />
            ))}

            {/* Trace */}
            {tracePath ? (
              <Path d={tracePath} stroke={C.trace} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
            ) : null}

            {/* Peak markers */}
            {visiblePeaks.map((p, i) => {
              const x = p.localIdx * PX_PER_PT;
              // find the normalised y at this point
              const normY = visibleNorm[p.localIdx] ?? 0.5;
              const y = 16 + (1 - normY) * (CHART_H - 32);
              return (
                <React.Fragment key={i}>
                  <Circle cx={x} cy={y} r={4} fill={colorForClass(p.classification)} />
                  {p.classification !== 'normal' && (
                    <SvgText
                      x={x} y={y - 10}
                      fontSize={9} fill={colorForClass(p.classification)}
                      textAnchor="middle"
                    >
                      {p.classification === 'alert' ? '!' : '?'}
                    </SvgText>
                  )}
                </React.Fragment>
              );
            })}

            {/* "Waiting" label */}
            {noDevice && (
              <SvgText x={VISIBLE_W / 2} y={CHART_H / 2} fontSize={14}
                fill={C.muted} textAnchor="middle">
                Connect a device to see waveform
              </SvgText>
            )}
          </Svg>
        </View>

        {/* ── HRV metrics ──────────────────────────────────────────────────── */}
        <View className="px-4 mt-4 flex-row gap-3">
          {[
            { label: 'Heart Rate',   value: hrvStats.bpm > 0 ? `${hrvStats.bpm}` : data.hr,  unit: 'BPM',  color: C.trace },
            { label: 'RMSSD',        value: `${hrvStats.rmssd}`,                              unit: 'ms',   color: C.hrv   },
            { label: 'SDNN',         value: `${hrvStats.sdnn}`,                               unit: 'ms',   color: C.hrv   },
            { label: 'SpO₂',         value: data.oxy,                                         unit: '%',    color: '#60a5fa' },
          ].map(metric => (
            <View key={metric.label} style={{
              flex: 1,
              backgroundColor: '#111827',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#1f2937',
              padding: 12,
              alignItems: 'center',
            }}>
              <Text style={{ color: metric.color, fontSize: 20, fontWeight: '700' }}>
                {metric.value}
              </Text>
              <Text style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>{metric.unit}</Text>
              <Text style={{ color: C.muted, fontSize: 9, marginTop: 2 }}>{metric.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Recent beats table ───────────────────────────────────────────── */}
        <View className="px-4 mt-4">
          <Text className="text-zinc-400 text-xs uppercase tracking-widest mb-2 px-1">
            Recent beats
          </Text>
          <View style={{ backgroundColor: '#111827', borderRadius: 12, borderWidth: 1, borderColor: '#1f2937', overflow: 'hidden' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1f2937' }}>
              {['#', 'RR (ms)', 'Z-score', 'Class'].map(h => (
                <Text key={h} style={{ flex: 1, color: C.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {h}
                </Text>
              ))}
            </View>

            {peaks.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: C.muted }}>Waiting for peaks…</Text>
              </View>
            ) : (
              [...peaks].reverse().slice(0, 10).map((p, i) => (
                <View key={i} style={{
                  flexDirection: 'row',
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderBottomWidth: i < 9 ? 1 : 0,
                  borderBottomColor: '#1f2937',
                  backgroundColor: p.classification === 'alert'   ? '#450a0a44' :
                                    p.classification === 'warning' ? '#451a0344' : 'transparent',
                }}>
                  <Text style={{ flex: 1, color: C.muted, fontSize: 13 }}>
                    {peaks.length - i}
                  </Text>
                  <Text style={{ flex: 1, color: C.text, fontSize: 13 }}>
                    {Math.round(p.rrMs)}
                  </Text>
                  <Text style={{ flex: 1, color: colorForClass(p.classification), fontSize: 13 }}>
                    {p.z.toFixed(2)}
                  </Text>
                  <Text style={{ flex: 1, color: colorForClass(p.classification), fontSize: 13, fontWeight: '600' }}>
                    {p.classification.charAt(0).toUpperCase() + p.classification.slice(1)}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* ── Algorithm info card ──────────────────────────────────────────── */}
        <View className="px-4 mt-4">
          <View style={{ backgroundColor: '#111827', borderRadius: 12, borderWidth: 1, borderColor: '#1f2937', padding: 16 }}>
            <Text style={{ color: C.text, fontWeight: '600', marginBottom: 8 }}>Detection method</Text>
            <Text style={{ color: C.muted, fontSize: 13, lineHeight: 20 }}>
              Peaks are found using a rolling-mean threshold (×{PEAK_FACTOR}) with a {MIN_RR_MS} ms refractory period.
              RR intervals are scored using the modified Z-score (Iglewicz–Hoaglin) against the last {RR_WINDOW} beats.
              RMSSD and SDNN are standard HRV metrics — low RMSSD can indicate reduced autonomic flexibility.
            </Text>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
              {[
                { label: 'Warning', threshold: `Z > ${Z_WARNING}`, color: C.warn  },
                { label: 'Alert',   threshold: `Z > ${Z_ALERT}`,   color: C.alert },
              ].map(t => (
                <View key={t.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color }} />
                  <Text style={{ color: C.muted, fontSize: 12 }}>{t.label}: {t.threshold}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default Charts;