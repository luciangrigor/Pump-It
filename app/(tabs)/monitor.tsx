import React , { useEffect }from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBle } from '../../context/BleContext';

const SERVICE_UUID = "e3b8e649-fb8a-45eb-a81b-d05d8c96681e";
const CHAR_HR_UUID = "cf19a6c7-c16d-47c3-bfd9-4a1020bb79e4";
const CHAR_OXY_UUID = "cf19a6c7-c16d-47c3-bfd9-4a1020bb79e5";
const CHAR_STATUS_UUID = "cf19a6c7-c16d-47c3-bfd9-4a1020bb79e6";



const Monitor = () => {
  const { connectedDevice, data, setData } = useBle();

  useEffect(() => {
    if (!connectedDevice) return;

    // Monitor Heart Rate
    const hrSubscription = connectedDevice.monitorCharacteristicForService(
      SERVICE_UUID, CHAR_HR_UUID, (error, char) => {
        if (char?.value) {
          const decoded = atob(char.value);
          setData(prev => ({ ...prev, hr: decoded }));
        }
      }
    );

    // Montior Oxygen
    const oxySubscription = connectedDevice.monitorCharacteristicForService(
      SERVICE_UUID, CHAR_OXY_UUID, (error, char) => {
        if (char?.value) {
          const decoded = atob(char.value)
          setData(prev => ({...prev, oxy: decoded }));
        }
      }
    );

    // Monitor Status
    const statusSubscription = connectedDevice.monitorCharacteristicForService(
      SERVICE_UUID, CHAR_STATUS_UUID, (error, char) => {
        if (char?.value) {
          const decoded = atob(char.value)
          setData(prev => ({...prev, status: decoded }));
       }
      }
    );

    return () => {
      hrSubscription.remove();
      oxySubscription.remove();
      statusSubscription.remove();
    };
  }, [connectedDevice, setData]);
  
  return (    
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-10 pb-5">
        <Text className="text-white text-3xl font-bold">Monitor</Text>
        <Text className="text-zinc-300 text-1xl mt-2">
          Heart Rate: <Text className="text-primary-light">{data.hr} BPM</Text>
        </Text>
        <Text className="text-zinc-300 text-1xl mt-2">
          Oxygen: <Text className="text-primary-light">{data.oxy}%</Text>
        </Text>
        <Text className="text-zinc-300 text-1xl mt-2">
          Status: <Text className="text-primary-light">{data.status}</Text>
        </Text>
        {!connectedDevice && (
          <Text className="text-red-400 mt-10">No device connected. Please go to Search.</Text>
        )}
      </View>
    </SafeAreaView>
  )
}

export default Monitor;