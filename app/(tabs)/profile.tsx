import { account, getUser, logout } from '@/lib/appwrite';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Health = { age: string; sex: string; height: string; weight: string; restingHR: string; activity: string; smoker: string };
const EMPTY: Health = { age: '', sex: '', height: '', weight: '', restingHR: '', activity: '', smoker: '' };

const InfoRow = ({ label, value, last = false }: { label: string; value: string; last?: boolean }) => (
  <View className={`flex-row items-center px-4 py-4 ${last ? '' : 'border-b border-filler-light'}`}>
    <Text className="text-zinc-400 flex-1">{label}</Text>
    <Text className="text-white font-medium">{value || '—'}</Text>
  </View>
);

const Profile = () => {
  const router     = useRouter();
  const [user, setUser]             = useState<any>(null);
  const [health, setHealth]         = useState<Health>(EMPTY);
  const [loading, setLoading]       = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // refresh on focus
  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      const u = await getUser();
      if (!active) return;
      setUser(u);
      try {
        const prefs = await account.getPrefs();
        if (!active) return;
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
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []));

  const handleLogout = () =>
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await logout();
          router.replace('/welcome');
        },
      },
    ]);

  const memberSince = user?.$createdAt
    ? new Date(user.$createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>

        <View className="pt-10 pb-5 items-center">
          <Text className="text-white text-3xl font-bold">Profile</Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center mt-20">
            <ActivityIndicator color="#db2777" size="large" />
          </View>
        ) : (
          <View className="px-6 gap-4">

            {/* account */}
            <View className="bg-filler-dark border border-filler-light rounded-xl overflow-hidden">
              <InfoRow label="Name"         value={user?.name ?? '—'} />
              <InfoRow label="Email"        value={user?.email ?? '—'} />
              <InfoRow label="Member since" value={memberSince} last />
            </View>

            {/* health */}
            <Text className="text-zinc-400 text-xs uppercase tracking-widest px-1 mt-2">Health Profile</Text>
            <View className="bg-filler-dark border border-filler-light rounded-xl overflow-hidden">
              <InfoRow label="Age"            value={health.age       ? `${health.age} years`     : ''} />
              <InfoRow label="Sex"            value={health.sex} />
              <InfoRow label="Height"         value={health.height    ? `${health.height} cm`      : ''} />
              <InfoRow label="Weight"         value={health.weight    ? `${health.weight} kg`      : ''} />
              <InfoRow label="Resting HR"     value={health.restingHR ? `${health.restingHR} BPM` : ''} />
              <InfoRow label="Activity Level" value={health.activity} />
              <InfoRow label="Smoker"         value={health.smoker} last />
            </View>

            {/* edit */}
            <TouchableOpacity
              onPress={() => router.push('/onboarding?from=profile' as any)}
              className="flex-row items-center justify-center py-4 rounded-xl border bg-primary border-primary-light"
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={20} color="white" style={{ marginRight: 8 }} />
              <Text className="text-white font-bold text-lg">Edit Health Profile</Text>
            </TouchableOpacity>

            {/* logout */}
            <TouchableOpacity
              onPress={handleLogout} disabled={loggingOut}
              className="flex-row items-center justify-center py-4 rounded-xl border border-danger bg-filler-dark"
              activeOpacity={0.8}
            >
              {loggingOut
                ? <ActivityIndicator color="#dc2626" />
                : <Text className="text-danger font-semibold text-lg">Logout</Text>}
            </TouchableOpacity>

          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;
