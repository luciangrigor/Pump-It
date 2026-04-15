import { account, getUser, logout } from '@/lib/appwrite';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SEX_OPTIONS      = ['Male', 'Female', 'Other'];
const ACTIVITY_OPTIONS = ['0 days', '1-2 days', '2-4 days', '5+ days'];
const SMOKER_OPTIONS   = ['No', 'Yes'];

type Health = { age: string; sex: string; height: string; weight: string; restingHR: string; activity: string; smoker: string };
const EMPTY_HEALTH: Health = { age: '', sex: '', height: '', weight: '', restingHR: '', activity: '', smoker: '' };

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row items-center px-4 py-4 border-b border-filler-light">
    <Text className="text-zinc-400 flex-1">{label}</Text>
    <Text className="text-white font-medium">{value}</Text>
  </View>
);

const InputRow = ({ label, value, onChange, keyboardType = 'default', placeholder, last = false }: {
  label: string; value: string; onChange: (v: string) => void;
  keyboardType?: any; placeholder?: string; last?: boolean;
}) => (
  <View className={`flex-row items-center px-4 py-4 ${last ? '' : 'border-b border-filler-light'}`}>
    <Text className="text-zinc-400 flex-1">{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder ?? '—'}
      placeholderTextColor="#52525b"
      keyboardType={keyboardType}
      className="text-white font-medium text-right"
      style={{ minWidth: 80 }}
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
      <TouchableOpacity
        onPress={() => setExpanded(e => !e)}
        className="flex-row items-center px-4 py-4"
        activeOpacity={0.7}
      >
        <Text className="text-zinc-400 flex-1">{label}</Text>
        <View className="flex-row items-center" style={{ gap: 6 }}>
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
                className={`flex-row items-center px-6 py-3 ${i < options.length - 1 ? 'border-b border-filler-light' : ''}`}
                style={{ backgroundColor: selected ? 'rgba(219,39,119,0.08)' : 'transparent' }}
                activeOpacity={0.6}
              >
                <Text style={{ flex: 1, color: selected ? '#ec4899' : '#d4d4d8', fontSize: 15, fontWeight: selected ? '600' : '400' }}>
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

const Profile = () => {
  const router = useRouter();
  const [user, setUser]         = useState<any>(null);
  const [health, setHealth]     = useState<Health>(EMPTY_HEALTH);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const set = (key: keyof Health) => (v: string) => setHealth(h => ({ ...h, [key]: v }));

  useEffect(() => {
    (async () => {
      const u = await getUser();
      setUser(u);
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
    setSaving(true);
    try {
      await (account as any).updatePrefs(health);
      Alert.alert('Saved', 'Health profile updated.');
    } catch {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () =>
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await logout();
          router.replace('/home');
        },
      },
    ]);

  const memberSince = user?.$createdAt
    ? new Date(user.$createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">

        <View className="pt-10 pb-5 items-center">
          <Text className="text-white text-3xl font-bold">Profile</Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center mt-20">
            <ActivityIndicator color="#db2777" size="large" />
          </View>
        ) : (
          <View className="px-6 gap-4">

            {/* Avatar */}
            <View className="items-center py-4">
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} className="w-24 h-24 rounded-full" />
              ) : (
                <View className="w-24 h-24 rounded-full bg-primary items-center justify-center">
                  <Text className="text-white text-3xl font-bold">
                    {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </Text>
                </View>
              )}
              <Text className="text-white text-2xl font-bold mt-4">{user?.name ?? 'Unknown'}</Text>
              <Text className="text-zinc-400 mt-1">{user?.email ?? ''}</Text>
            </View>

            {/* Account */}
            <View className="bg-filler-dark border border-filler-light rounded-xl">
              <InfoRow label="Name"         value={user?.name ?? '—'} />
              <InfoRow label="Email"        value={user?.email ?? '—'} />
              <InfoRow label="Member since" value={memberSince} />
            </View>

            {/* Health Profile */}
            <Text className="text-zinc-400 text-xs uppercase tracking-widest px-1 mt-2">Health Profile</Text>
            <View className="bg-filler-dark border border-filler-light rounded-xl overflow-hidden">
              <InputRow  label="Age"            value={health.age}       onChange={set('age')}       keyboardType="numeric" placeholder="years" />
              <PickerRow label="Sex"            value={health.sex}       options={SEX_OPTIONS}       onSelect={set('sex')} />
              <InputRow  label="Height"         value={health.height}    onChange={set('height')}    keyboardType="numeric" placeholder="cm" />
              <InputRow  label="Weight"         value={health.weight}    onChange={set('weight')}    keyboardType="numeric" placeholder="kg" />
              <InputRow  label="Resting HR"     value={health.restingHR} onChange={set('restingHR')} keyboardType="numeric" placeholder="BPM" />
              <PickerRow label="Activity Level" value={health.activity}  options={ACTIVITY_OPTIONS}  onSelect={set('activity')} />
              <PickerRow label="Smoker"         value={health.smoker}    options={SMOKER_OPTIONS}    onSelect={set('smoker')} last />
            </View>

            {/* Save */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className="flex-row items-center justify-center py-4 rounded-xl border bg-primary border-primary-light"
              activeOpacity={0.8}
            >
              {saving ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Save Health Profile</Text>}
            </TouchableOpacity>

            {/* Logout */}
            <TouchableOpacity
              onPress={handleLogout}
              disabled={loggingOut}
              className="flex-row items-center justify-center py-4 rounded-xl border border-danger bg-filler-dark"
              activeOpacity={0.8}
            >
              {loggingOut ? <ActivityIndicator color="#dc2626" /> : <Text className="text-danger font-semibold text-lg">Logout</Text>}
            </TouchableOpacity>

          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;
