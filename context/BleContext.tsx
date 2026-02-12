import React, {
    createContext,
    ReactNode,
    useContext,
    useState
} from 'react';
import { Device } from 'react-native-ble-plx';

interface BleContextType {
    connectedDevice: Device | null;
    setConnectedDevice: (device: Device | null) => void;
    data: { hr: string; oxy: string; status: string;};
    setData: React.Dispatch<React.SetStateAction <{
        hr: string; oxy: string; status: string }>>;
}

const BLeContext = createContext<BleContextType | undefined>(undefined);

export const BleProvider = ({ children }: { children: ReactNode }) => {
    const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
    const [data, setData] = useState({ hr: '0', oxy: '0', status: '0' });

    return (
        <BLeContext.Provider value={{ connectedDevice, setConnectedDevice, data, setData}}>
            {children}
        </BLeContext.Provider>
    );
}

export const useBle = () => {
    const context = useContext(BLeContext);
    if (!context) throw new Error("useBle must be used within BleProvider");
    return context;
};