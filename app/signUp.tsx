import { account } from '@/lib/appwrite';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ID } from 'react-native-appwrite';
import { SafeAreaView } from 'react-native-safe-area-context';

const SignUp = () => {
  const router = useRouter();
  const [name, setName]                       = useState('');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]                 = useState(false);
  const [showPassword, setShowPassword]       = useState(false);

  const handleSignUp = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields'); return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match'); return;
    }
    setLoading(true);
    try {
      await account.create(ID.unique(), email, password, name);
      await account.createEmailPasswordSession(email, password);
      router.replace('/onboarding');
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message || 'Something went wrong');
      router.replace('/signUp');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-10">

        {/* back + title */}
        <TouchableOpacity onPress={() => router.replace('/home')} className="mb-6">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-3xl font-bold">Create Account</Text>
        <Text className="text-zinc-400 mt-2 mb-6">Enter your details:</Text>

        {/* fields */}
        <View className="gap-4">
          <View className="bg-filler-dark border border-filler-light rounded-xl px-4 py-4">
            <Text className="text-zinc-400 text-xs mb-1">Name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#71717a" className="text-white text-base" />
          </View>

          <View className="bg-filler-dark border border-filler-light rounded-xl px-4 py-4">
            <Text className="text-zinc-400 text-xs mb-1">Email</Text>
            <TextInput value={email} onChangeText={setEmail} placeholder="your@email.com" placeholderTextColor="#71717a" keyboardType="email-address" autoCapitalize="none" className="text-white text-base" />
          </View>

          <View className="bg-filler-dark border border-filler-light rounded-xl px-4 py-4">
            <Text className="text-zinc-400 text-xs mb-1">Password</Text>
            <View className="flex-row items-center">
              <TextInput value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor="#71717a" secureTextEntry={!showPassword} className="text-white text-base flex-1" />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#71717a" />
              </TouchableOpacity>
            </View>
          </View>

          <View className="bg-filler-dark border border-filler-light rounded-xl px-4 py-4">
            <Text className="text-zinc-400 text-xs mb-1">Confirm Password</Text>
            <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="••••••••" placeholderTextColor="#71717a" secureTextEntry={!showPassword} className="text-white text-base" />
          </View>

          <TouchableOpacity
            onPress={handleSignUp} disabled={loading}
            className="flex-row items-center justify-center py-4 rounded-xl border bg-primary border-primary-light mt-2"
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={20} color="white" style={{ marginRight: 8 }} />
                <Text className="text-white font-bold text-lg">Create Account</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
};

export default SignUp;
