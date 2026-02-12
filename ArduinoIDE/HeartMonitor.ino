/* Possible ERROR:

 1 = Unavailable Command
 2 = Unavailable Function
 3 = Data Format Error
 4 = Input Value Error
 5 = Try Again
 255 = Error Unknown

*/
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>

#include <SparkFun_Bio_Sensor_Hub_Library.h>
#include <Wire.h>

#define SERVICE_UUID        "e3b8e649-fb8a-45eb-a81b-d05d8c96681e"

#define CHAR_HR_UUID        "cf19a6c7-c16d-47c3-bfd9-4a1020bb79e4"
#define CHAR_OXY_UUID       "cf19a6c7-c16d-47c3-bfd9-4a1020bb79e5"
#define CHAR_STATUS_UUID    "cf19a6c7-c16d-47c3-bfd9-4a1020bb79e6"

BLECharacteristic *hrateCharacteristics;
BLECharacteristic *oxygenCharacteristics;
BLECharacteristic *statusCharacteristics;

bool deviceConnected = false;

class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) { deviceConnected = true; };
  void onDisconnect(BLEServer* pServer) { deviceConnected = false; };
};

// Reset pin, MFIO pin
int resPin = 4;
int mfioPin = 5;

int algoRange = 100;    // ADC Range (0-100%)
int algoStepSize = 10;  // Step Size (0-100%)
int algoSens = 25;      // Sensitivity (0-100%)
int algoSamp = 5;       // Number of samples to average (0-255)

SparkFun_Bio_Sensor_Hub bioHub(resPin, mfioPin); 

bioData body; 

void setup(){

  Serial.begin(115200);
  Wire.begin();

  // bioHub logic for sensor
  int result = bioHub.begin();
  if (result == 0) { Serial.println("Sensor started!"); }
  else { Serial.print("Sensor not functional! ERROR: "); Serial.println(result); }
  
  // Adjusting the Automatic Gain Control (AGC) Algorithm
  int error = bioHub.setAlgoRange(algoRange); delay(100);
  if (error > 0){ Serial.println("Could not set algorithm's Range."); }
  else          { Serial.print  ("Algorithm set to: "); Serial.println(bioHub.readAlgoRange()); }

  error = bioHub.setAlgoStepSize(algoStepSize); delay(100);
  if (error > 0){ Serial.println("Could not set the Step size."); }
  else          { Serial.print  ("Algorithm set to: "); Serial.println(bioHub.readAlgoStepSize()); }
  
  error = bioHub.setAlgoSensitivity(algoSens); delay(100);
  if (error > 0){ Serial.println("Could not set the sensitivity."); }
  else          { Serial.print  ("Algorithm set to: "); Serial.println(bioHub.readAlgoSensitivity()); }
  
  error = bioHub.setAlgoSamples(algoSamp); delay(100);
  if (error > 0){ Serial.println("Could not set the sample size."); }
  else          { Serial.print  ("Algorithm set to: "); Serial.println(bioHub.readAlgoSamples()); }
 
  delay(100);

  // Setting the Sensor Mode
  Serial.println("Configuring Sensor...");
  error = bioHub.configBpm(MODE_ONE);
  if (error > 0){ Serial.println("Could not configure the sensor."); }
  else          { Serial.println("Sensor Configured."); }

  delay(100);

  // BLE logic for connection and initializing server
  Serial.println("Initializing Bluetooth...");
  if (!BLEDevice::init("Pump It")) { Serial.println("Initialization Failed!"); }
  else { Serial.println("Initialization Success!");}

  // Create Server
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
 
  // Create Service
  BLEService *sensorService = pServer->createService(SERVICE_UUID);

  // Create Characteristics and BLE Descriptor

  // Heart Rate
  hrateCharacteristics = sensorService->createCharacteristic(
      CHAR_HR_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY );
  hrateCharacteristics->addDescriptor(new BLE2902());

  BLEDescriptor *nameHR = new BLEDescriptor((uint16_t)0x2901);
  nameHR->setValue("Heart Rate"); hrateCharacteristics->addDescriptor(nameHR);
  
  // Oxygen Rate
  oxygenCharacteristics = sensorService->createCharacteristic(
      CHAR_OXY_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY );
  oxygenCharacteristics->addDescriptor(new BLE2902());

  BLEDescriptor *nameOXY = new BLEDescriptor((uint16_t)0x2901); 
  nameOXY->setValue("Oxygen Rate"); oxygenCharacteristics->addDescriptor(nameOXY);

  // Status Rate
  statusCharacteristics = sensorService->createCharacteristic
    ( CHAR_STATUS_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY );
  statusCharacteristics->addDescriptor(new BLE2902());

  BLEDescriptor *nameSTATUS = new BLEDescriptor((uint16_t)0x2901);
  nameSTATUS->setValue("Status"); statusCharacteristics->addDescriptor(nameSTATUS);

  // Starting Service
  sensorService->start();
  
  delay(100);

  // Starting Advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID); pAdvertising->setScanResponse(true);
  BLEDevice::startAdvertising();

  delay(100);
 
  // Waiting for data to catch up
  Serial.println("Loading up the buffer with data....");
  delay(5000);
  Serial.println("Device ONLINE!");
  delay(1000);
}

void loop(){
  
    body = bioHub.readBpm();

    // Sending only the good data out
    if (body.confidence >= 80){
      // Debug prints
      Serial.print("Heartrate: ");  Serial.println(body.heartRate);
      Serial.print("Confidence: "); Serial.println(body.confidence); 
      Serial.print("Oxygen: ");     Serial.println(body.oxygen); 
      Serial.print("Status: ");     Serial.println(body.status);
      
      // Sending Data
      if (deviceConnected) {
        // Send Heart Rate
        hrateCharacteristics->setValue(String(body.heartRate));
        hrateCharacteristics->notify();
        // Send Oxygen
        oxygenCharacteristics->setValue(String(body.oxygen));
        oxygenCharacteristics->notify();
        // Send Status
        statusCharacteristics->setValue(String(body.status));
        statusCharacteristics->notify();

        Serial.println("Data Sent");
      }
    } else if (body.status < 3 && body.status > 0) Serial.println("Object detected. Analyzing...");
   
    delay(200); 
  
}
