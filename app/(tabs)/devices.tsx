import { useBle } from '../../context/BleContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  PermissionsAndroid,
  Platform,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import { SafeAreaView } from 'react-native-safe-area-context';

const manager = new BleManager();

const Devices = () => {

  // BlueTooth Hooks
  const router = useRouter();
  const { setConnectedDevice, connectedDevice } = useBle();
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const requestBluetoothPermission = async () =>{

    // For iOS
    if (Platform.OS === 'ios') return true;

    // For Android
    if (Platform.OS === 'android' && PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION){
      const apiLevel = parseInt(Platform.Version.toString(), 10);
      
      // Android <12
      if (apiLevel < 31){
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }

      // Android 12+
      if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN && PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT){
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        ])
        return (
          result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED 
        )
      }
    }
    return false;
  }

  // Scanning new devices
  const startScan = async () => {

    const isGranted = await requestBluetoothPermission();
    if (!isGranted) return;

    setIsScanning(true);
    setDevices([]);
   
    // Check for Bluetooth if on
    const state = await manager.state();
    console.log(state);
    if (state !== 'PoweredOn'){
      if (Platform.OS === 'android'){
        try {
          await manager.enable()
        } catch (error) {
          console.log(error)
          Alert.alert("Permission Denied", "Bluetooth must be on to scan.");
          return;
        }
      }
      else {
        Alert.alert("Bluetooth is Off", "Please turn on Bluetooth in settings.");
        return;
      }
    }

    manager.startDeviceScan(null, null, (error, device) =>{
      if (error){
        console.log(error);
        setIsScanning(false);
        return;
      }
      if (device && device.name === 'Pump It'){
        setDevices((prevDevices) => {
          if (!prevDevices.some(d => d.id === device.id)){
            return [...prevDevices, device];
          }
          return prevDevices;
        });
      }
    });
  }

  // Stop scanning new devices
  const stopScan = () => {
    setIsScanning(false);
    manager.stopDeviceScan();
  }

  // Connecting to a device
  const connectToDevice = async (device: Device) => {
    try {
      manager.stopDeviceScan();
      setIsScanning(false);

      // Cancel any stale connection first so we get a clean GATT session
      try { await manager.cancelDeviceConnection(device.id); } catch {}

      console.log(`Connecting to ${device.name}...`);
      const connected = await manager.connectToDevice(device.id, { autoConnect: false, requestMTU: 512, timeout: 8000 });
      await connected.discoverAllServicesAndCharacteristics();

      setConnectedDevice(connected);

      Alert.alert('Success', `Connected to ${device.name}`);
      console.log('Connected.');
      router.push('/(tabs)/monitor');

    } catch (error) {
      console.log('Connection failed', error);
      Alert.alert('Error', 'Failed to connect to device');
    }
  }

  // Disconnect from a device
  const disconnectFromDevice = async (device: Device) => {
    try {
      await manager.cancelDeviceConnection(device.id);
    } catch (error) {
      console.log('Disconnect error (ignored)', error);
    }
    setConnectedDevice(null);
    setDevices([]);
    Alert.alert('Disconnected', `Disconnected from ${device.name}`);
  }

  // UI for each row of device
  const renderDeviceItem = ({ item } : { item: Device }) => {

    // Style components
    const isConnected = connectedDevice?.id === item.id;
    const containerStyle = isConnected ? "bg-success-dark border-success-light" : "bg-filler-light border-filler-dark";
    const buttonStyle = isConnected ? "bg-success" : "bg-primary";
    const buttonText = isConnected ? "Disconnect" : "Connect";
    // View
    return(
    <View className={`p-4 mb-3 rounded-xl border flex-row justify-between items-center ${containerStyle}`}>
      <View>
        <Text className="text-white font-bold text-lg">{item.name}</Text>
        <Text className="text-zinc-400 text-sm">{item.id}</Text>
        {item.rssi && (
          <Text className="text-zinc-500 text-xs mt-1">Signal: {item.rssi}</Text>
        )}
      </View>
      <TouchableOpacity 
        onPress={() => isConnected ? disconnectFromDevice(item) : connectToDevice(item)}
        className={`px-4 py-2 rounded-lg ${buttonStyle}`}
        >
          <Text className="text-white font-semibold">{buttonText}</Text>
      </TouchableOpacity>
    </View>
    )
  }

  // UI
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-10 pb-3">
        <Text className="text-white text-3xl font-bold">Search Devices</Text>
        <Text className="text-zinc-400 mt-2">Found {devices.length} devices</Text>
      </View>

    {/* Scan button */}
      <View className="px-6 py-6">
        <TouchableOpacity
            onPress={isScanning ? stopScan : startScan}
            activeOpacity={0.7}
            className={`flex-row items-center justify-center py-4 rounded-xl border ${isScanning ? 'bg-filler-dark border-primary' : 'bg-primary border-primary-light'}`}
          >
            {isScanning ? (
              <>
                <ActivityIndicator color="#ec4899" style={{ marginRight: 8 }} />
                <Text className="text-primary-light font-semibold text-lg">Stop Scanning</Text>
              </>
            ) : (
              <>
                <Ionicons name="search" size={20} color="white" style={{ marginRight: 8 }} />
                <Text className="text-white font-bold text-lg">Start Scan</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

    {/* FlatList used for displaying each device found */}
      <View className="flex-1 px-4">
        <FlatList
          data={devices}
          extraData={connectedDevice?.id}
          keyExtractor={(item) => item.id}
          renderItem={renderDeviceItem}
          contentContainerStyle={{ paddingBottom: 100}}
        />
      </View>
    </SafeAreaView>
  );
}

export default Devices;
