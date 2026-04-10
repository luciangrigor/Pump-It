import { images } from "@/constants/images";
import React from 'react';
import { Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const signIn = () => {
  return (
    <SafeAreaView className=" bg-background h-full">
      <ScrollView contentContainerClassName="h-full">
        <Image source = {images.logo_big} className="w-full mt-20" resizeMode="contain"></Image>
        
      </ScrollView>
    </SafeAreaView>
  )
}

export default signIn;