import { Stack } from "expo-router";
import { BleProvider } from "../context/BleContext";
import './globals.css';

export default function RootLayout() {
  return (
  <BleProvider>
    <Stack>
      <Stack.Screen
        name='home'
        options={{ headerShown: false, animation: 'slide_from_left'}}
      />
      <Stack.Screen
        name='login'
        options={{ headerShown: false, animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name='signUp'
        options={{ headerShown: false, animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="(tabs)"
        options={{ headerShown: false, animation: 'slide_from_bottom'}}
      />
    </Stack>
  </BleProvider>
  );
}
