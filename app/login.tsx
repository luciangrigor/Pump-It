import { account } from '@/lib/appwrite';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Login = () => {
  const router = useRouter();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Please fill in all fields'); return; }
    setLoading(true);
    try {
      await account.createEmailPasswordSession(email, password);
      const prefs = await account.getPrefs();
      router.replace(prefs.onboardingDone ? '/(tabs)/home' : '/onboarding');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

          {/* back + title */}
          <View className="px-6 pt-10 pb-5">
            <TouchableOpacity onPress={() => router.replace('/home')} className="mb-6">
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-3xl font-bold">Login</Text>
            <Text className="text-zinc-400 mt-2">Sign in to your account</Text>
          </View>

          {/* fields */}
          <View className="px-6 gap-4">
            <View className="bg-filler-dark border border-filler-light rounded-xl px-4 py-4">
              <Text className="text-zinc-400 text-xs mb-1">Email</Text>
              <TextInput
                value={email} onChangeText={setEmail}
                placeholder="your@email.com" placeholderTextColor="#71717a"
                keyboardType="email-address" autoCapitalize="none"
                className="text-white text-base"
              />
            </View>

            <View className="bg-filler-dark border border-filler-light rounded-xl px-4 py-4">
              <Text className="text-zinc-400 text-xs mb-1">Password</Text>
              <View className="flex-row items-center">
                <TextInput
                  value={password} onChangeText={setPassword}
                  placeholder="••••••••" placeholderTextColor="#71717a"
                  secureTextEntry={!showPassword}
                  className="text-white text-base flex-1"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#71717a" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleLogin} disabled={loading}
              className="flex-row items-center justify-center py-4 rounded-xl border bg-primary border-primary-light mt-2"
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text className="text-white font-bold text-lg">Login</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Login;
