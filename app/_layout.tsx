import { Stack } from "expo-router";
import { BleProvider } from "../context/BleContext";
import './globals.css';

export default function RootLayout() {
  return (
  <BleProvider>
    <Stack>
      <Stack.Screen
        name="(tabs)"
        options={{ headerShown: false}}
      />
    </Stack>
  </BleProvider>
  );
}
