import { images } from "@/constants/images";
import { Tabs } from 'expo-router';
import React from "react";
import { Image, Text, View } from 'react-native';

const TabIcon = ({ focused, icon, title }: any) => {
    if(focused)
        return (
            <View className=" flex-1 flex justify-center items-center w-20 mt-4">
                <Image source={icon}/>
                <Text className="text-['#eef1ea'] font-medium text-xs">{title}</Text>
                <View className="h-1 w-8 bg-white rounded-full" />
            </View>
        )
    else
        return (
            <View className="flex-1 justify-center items-center w-20 mt-4  ">
                <Image source={icon}/> 
                <Text className="text-['#878782'] text-xs">{title}</Text>
            </View>
        )
}

const _layout = () => {
  return (
    <Tabs
        screenOptions={{
            tabBarShowLabel: false,
            tabBarItemStyle: {
                width: '100%',
                height: '100%',
                alignContent: 'center',
            },
            tabBarStyle: {
                backgroundColor: '#0e1317', 
                borderRadius: 10,
                marginHorizontal: 5,
                marginBottom: 47,
                height: 70,
                position: 'absolute',
                borderWidth: 5,
                borderTopWidth: 5,
                borderColor: '#232d2d'
            }
        }}
    >
        <Tabs.Screen 
            name="index"
            options={{
                title: 'Home',
                headerShown: false,
                tabBarIcon: ({focused}) => (
                    <TabIcon
                        focused={focused}
                        icon={images.logo}
                        title="Home"
                    />
                )
            }}
        />
        <Tabs.Screen
            name="charts"
            options={{
                title: 'Charts',
                headerShown: false,
                tabBarIcon: ({focused}) =>(
                    <TabIcon 
                        focused={focused} 
                        icon={images.charts}
                        title="Charts"
                    />
                )
            }}
        />
        <Tabs.Screen
            name="monitor"
            options={{
                title: 'Monitor',
                headerShown: false,
                tabBarIcon: ({focused}) => (
                    <TabIcon
                        focused={focused}
                        icon={images.monitor}
                        title="Monitor"
                    />
                )
            }}
        />
        <Tabs.Screen
            name="devices"
            options={{
                title: 'Devices',
                headerShown: false,
                tabBarIcon: ({focused}) => (
                    <TabIcon
                        focused={focused}
                        icon={images.devices}
                        title="Devices"
                    />
                )
            }}
        />
        <Tabs.Screen
            name="profile"
            options={{
                title: 'Profile',
                headerShown: false,
                tabBarIcon: ({focused}) => (
                    <TabIcon
                        focused={focused}
                        icon={images.profile}
                        title="Profile"
                    />
                )
            }}
        />
    </Tabs>
  )
}

export default _layout