import { account } from '@/lib/appwrite';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SEX_OPTIONS      = ['Male', 'Female', 'Other'];
const ACTIVITY_OPTIONS = ['0 days', '1-2 days', '2-4 days', '5+ days'];
const SMOKER_OPTIONS   = ['No', 'Yes'];

type Health = { age: string; sex: string; height: string; weight: string; restingHR: string; activity: string; smoker: string };
const EMPTY: Health    = { age: '', sex: '', height: '', weight: '', restingHR: '', activity: '', smoker: '' };

function validate(h: Health): string | null {
  const age = parseInt(h.age),  ht = parseFloat(h.height);
  const wt  = parseFloat(h.weight), hr = parseInt(h.restingHR);
  if ((h.age       && (isNaN(age) || age < 1  || age > 120)) || 
      (h.height    && (isNaN(ht)  || ht  < 50 || ht  > 300)) || 
      (h.weight    && (isNaN(wt)  || wt  < 10 || wt  > 500)) ||
      (h.restingHR && (isNaN(hr)  || hr  < 20 || hr  > 250))) 
     return "Unrealistic inputs."
  return null;
}

const InputRow = ({ label, value, onChange, keyboardType = 'default', placeholder, last = false }: {
  label: string; value: string; onChange: (v: string) => void;
  keyboardType?: any; placeholder?: string; last?: boolean;
}) => (
  <View className={`flex-row items-center px-4 py-4 ${last ? '' : 'border-b border-filler-light'}`}>
    <Text className="text-zinc-400 flex-1">{label}</Text>
    <TextInput
      value={value} onChangeText={onChange}
      placeholder={placeholder ?? '—'} placeholderTextColor="#52525b"
      keyboardType={keyboardType}
      className="text-white font-medium text-right min-w-20"
    />
  </View>
);

const PickerRow = ({ label, value, options, onSelect, last = false }: {
  label: string; value: string; options: string[];
  onSelect: (v: string) => void; last?: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <View className={last && !expanded ? '' : 'border-b border-filler-light'}>
      <TouchableOpacity onPress={() => setExpanded(e => !e)} className="flex-row items-center px-4 py-4" activeOpacity={0.7}>
        <Text className="text-zinc-400 flex-1">{label}</Text>
        <View className="flex-row items-center gap-1.5">
          <Text className="text-primary-light font-medium">{value || 'Select'}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#ec4899" />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View className="border-t border-filler-light">
          {options.map((opt, i) => {
            const selected = opt === value;
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => { onSelect(opt); setExpanded(false); }}
                className={`flex-row items-center px-6 py-3 ${i < options.length - 1 ? 'border-b border-filler-light' : ''} ${selected ? 'bg-primary/10' : ''}`}
                activeOpacity={0.6}
              >
                <Text className={`flex-1 text-base ${selected ? 'text-primary-light font-semibold' : 'text-zinc-200 font-normal'}`}>
                  {opt}
                </Text>
                {selected && <Ionicons name="checkmark" size={18} color="#ec4899" />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

// ─── screen ──────────────────────────────────────────────────────────────────

const Onboarding = () => {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromProfile = from === 'profile';

  const [health, setHealth]   = useState<Health>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const set = (key: keyof Health) => (v: string) => setHealth(h => ({ ...h, [key]: v }));

  // load prefs
  useEffect(() => {
    (async () => {
      try {
        const prefs = await account.getPrefs();
        setHealth({
          age:       prefs.age       ?? '',
          sex:       prefs.sex       ?? '',
          height:    prefs.height    ?? '',
          weight:    prefs.weight    ?? '',
          restingHR: prefs.restingHR ?? '',
          activity:  prefs.activity  ?? '',
          smoker:    prefs.smoker    ?? '',
        });
      } catch { }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    const err = validate(health);
    if (err) { Alert.alert('Invalid Input', err); return; }
    setSaving(true);
    try {
      await (account as any).updatePrefs({ ...health, onboardingDone: 'yes' });
      if (fromProfile) router.back(); else router.replace('/(tabs)/home');
    } catch {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (fromProfile) { router.back(); return; }
    try {
      const existing = await account.getPrefs();
      await (account as any).updatePrefs({ ...existing, onboardingDone: 'yes' });
    } catch { }
    router.replace('/(tabs)/home');
  };

  if (loading) return (
    <SafeAreaView className="flex-1 bg-background items-center justify-center">
      <ActivityIndicator color="primary" size="large" />
    </SafeAreaView>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

        {/* title */}
        <View className="px-6 pt-10 pb-6 items-center">
          <Text className="text-white text-3xl font-bold text-center">
            {fromProfile ? 'Edit Health Profile' : 'Health Profile'}
          </Text>
          <Text className="text-zinc-400 text-center mt-3 leading-6 px-2">
            This data helps the app accurately detect heart rate abnormalities.
          </Text>
        </View>

        {/* fields */}
        <View className="px-6 gap-4">
          <View className="bg-filler-dark border border-filler-light rounded-xl overflow-hidden">
            <InputRow  label="Age"            value={health.age}       onChange={set('age')}       keyboardType="numeric" placeholder="years" />
            <PickerRow label="Sex"            value={health.sex}       options={SEX_OPTIONS}       onSelect={set('sex')} />
            <InputRow  label="Height"         value={health.height}    onChange={set('height')}    keyboardType="numeric" placeholder="cm" />
            <InputRow  label="Weight"         value={health.weight}    onChange={set('weight')}    keyboardType="numeric" placeholder="kg" />
            <InputRow  label="Resting HR"     value={health.restingHR} onChange={set('restingHR')} keyboardType="numeric" placeholder="BPM" />
            <PickerRow label="Activity Level" value={health.activity}  options={ACTIVITY_OPTIONS}  onSelect={set('activity')} />
            <PickerRow label="Smoker"         value={health.smoker}    options={SMOKER_OPTIONS}    onSelect={set('smoker')} last />
          </View>

          {/* save */}
          <TouchableOpacity
            onPress={handleSave} disabled={saving}
            className="flex-row items-center justify-center py-4 rounded-xl border bg-primary border-primary-light mt-2"
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="white" style={{ marginRight: 8 }} />
                <Text className="text-white font-bold text-lg">
                  {fromProfile ? 'Save Changes' : 'Save & Get Started'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* skip/cancel */}
          <TouchableOpacity onPress={handleCancel} className="items-center py-3" activeOpacity={0.7}>
            <Text className="text-zinc-500 text-base">{fromProfile ? 'Cancel' : 'Skip for now'}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default Onboarding;
