import { images } from '@/constants/images';
import { account, login } from '@/lib/appwrite';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SignIn = () => {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const success = await login();
    setGoogleLoading(false);
    if (success) {
      try {
        const prefs = await account.getPrefs();
        router.replace(prefs.onboardingDone ? '/(tabs)/home' : '/onboarding');
      } catch {
        router.replace('/(tabs)/home');
      }
    } else {
      Alert.alert('Error', 'Google sign-in failed. Please try again.');
      router.replace('/welcome');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>

        {/*Heading*/}
        <View className="px-6 pt-10 pb-5">
          <Text className="text-white text-3xl font-bold">Welcome!</Text>
          <Text className="text-zinc-400 mt-2">Sign in or create an account to continue</Text>
        </View>

        <Image source={images.logo_big} className="w-full" resizeMode="contain" />

        <View className="px-6 py-6 gap-4">
          {/*Login*/}
          <TouchableOpacity
            onPress={() => router.push('/login')}
            className="flex-row items-center justify-center py-4 rounded-xl border bg-filler-dark border-filler-light"
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={20} color="#ec4899" style={{ marginRight: 8 }} />
            <Text className="text-primary-light font-semibold text-lg">Login</Text>
          </TouchableOpacity>

          {/*Sign Up*/}
          <TouchableOpacity
            onPress={() => router.push('/signUp')}
            className="flex-row items-center justify-center py-4 rounded-xl border bg-primary border-primary-light"
            activeOpacity={0.8}
          >
            <Ionicons name="person-add-outline" size={20} color="white" style={{ marginRight: 8 }} />
            <Text className="text-white font-bold text-lg">Sign Up</Text>
          </TouchableOpacity>

          {/*Line */}
          <View className="flex-row items-center my-2">
            <View className="flex-1 h-px bg-filler-light" />
            <Text className="text-zinc-500 mx-4 text-sm">or</Text>
            <View className="flex-1 h-px bg-filler-light" />
          </View>

          {/*Google*/}
          <TouchableOpacity
            onPress={handleGoogleLogin}
            disabled={googleLoading}
            className="flex-row items-center justify-center py-4 rounded-xl border bg-filler-dark border-filler-light"
            activeOpacity={0.8}
          >
            {googleLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <AntDesign name="google" size={20} color="white" style={{ marginRight: 8 }} />
                <Text className="text-white font-semibold text-lg">Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default SignIn;
