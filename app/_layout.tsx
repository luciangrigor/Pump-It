import { Stack } from 'expo-router';
import { BleProvider } from '../context/BleContext';
import './globals.css';

export default function RootLayout() {
  return (
    <BleProvider>
      <Stack>
        <Stack.Screen name="index"           options={{ headerShown: false }} />
        <Stack.Screen name="(auth)"         options={{ headerShown: false }} />
        <Stack.Screen name="onboarding"    options={{ headerShown: false, animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="(tabs)"        options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      </Stack>
    </BleProvider>
  );
}
