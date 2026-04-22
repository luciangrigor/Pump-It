import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen name="index"   options={{ headerShown: false }} />
      <Stack.Screen name="login"   options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="signUp"  options={{ headerShown: false, animation: 'slide_from_right' }} />
    </Stack>
  );
}
