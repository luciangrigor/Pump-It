/*
 * HeartMonitor_EKG.ino
 *
 * ESP32 + MAX32664 (biosensor hub) + MAX30101 (optical sensor)
 *
 * BLE characteristics:
 *   CHAR_HR_UUID     – computed heart rate string  (existing)
 *   CHAR_OXY_UUID    – SpO2 string                 (existing)
 *   CHAR_STATUS_UUID – confidence / status string  (existing)
 *   CHAR_PPG_UUID    – raw IR value as uint16 LE   (NEW – drives EKG waveform)
 *
 * The MAX32664 operates in "Algorithm + Sensor Output" mode so we get both
 * the processed biometrics AND the raw IR sample from the MAX30101.
 * Sample rate is configured at 25 Hz – comfortable for BLE notify bandwidth.
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Wire.h>

// ─── SparkFun MAX32664 library ────────────────────────────────────────────────
// Install via Arduino Library Manager: "SparkFun Bio Sensor Hub Library"
#include "SparkFun_Bio_Sensor_Hub_Library.h"

// ─── Pin definitions (adjust to your wiring) ──────────────────────────────────
#define RESET_PIN   4
#define MFIO_PIN    5
#define SDA_PIN     21
#define SCL_PIN     22

// ─── UUIDs (must match monitor.tsx / charts.tsx) ──────────────────────────────
#define SERVICE_UUID      "e3b8e649-fb8a-45eb-a81b-d05d8c96681e"
#define CHAR_HR_UUID      "cf19a6c7-c16d-47c3-bfd9-4a1020bb79e4"
#define CHAR_OXY_UUID     "cf19a6c7-c16d-47c3-bfd9-4a1020bb79e5"
#define CHAR_STATUS_UUID  "cf19a6c7-c16d-47c3-bfd9-4a1020bb79e6"
#define CHAR_PPG_UUID     "cf19a6c7-c16d-47c3-bfd9-4a1020bb79e7"   // NEW

// ─── Timing ───────────────────────────────────────────────────────────────────
// 25 Hz PPG notify  → 40 ms between samples
// Biometric notify  → every 1 s (MAX32664 updates ~1 Hz)
#define PPG_INTERVAL_MS    40
#define BIO_INTERVAL_MS  1000

// ─── Globals ──────────────────────────────────────────────────────────────────
SparkFun_Bio_Sensor_Hub bioHub(RESET_PIN, MFIO_PIN);
bioData body;                         // struct with hr, confidence, oxygen, irVal, redVal, …

BLECharacteristic* pCharHR     = nullptr;
BLECharacteristic* pCharOxy    = nullptr;
BLECharacteristic* pCharStatus = nullptr;
BLECharacteristic* pCharPPG    = nullptr;

bool deviceConnected = false;

unsigned long lastPpgNotify = 0;
unsigned long lastBioNotify = 0;

// ─── Connection callbacks ──────────────────────────────────────────────────────
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*)    override { deviceConnected = true;  Serial.println("BLE connected");    }
  void onDisconnect(BLEServer* s) override {
    deviceConnected = false;
    Serial.println("BLE disconnected – restarting advertising");
    BLEDevice::startAdvertising();
  }
};

// ─── Helper: create a notifiable characteristic ───────────────────────────────
BLECharacteristic* makeCharacteristic(BLEService* svc, const char* uuid) {
  BLECharacteristic* c = svc->createCharacteristic(
    uuid,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  c->addDescriptor(new BLE2902());
  return c;
}

// ─── setup ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Wire.begin(SDA_PIN, SCL_PIN);

  // ── MAX32664 init ──────────────────────────────────────────────────────────
  int result = bioHub.begin();
  if (result == 0) Serial.println("MAX32664 ready");
  else             Serial.printf("MAX32664 init error: %d\n", result);

  // Algorithm + Sensor Output mode: gives both biometrics AND raw IR/Red values
  // The library calls this "configBpm(MODE_TWO)" on SparkFun's hub library.
  bioHub.configBpm(MODE_TWO);          // MODE_TWO = algo + raw output
  bioHub.setPulseWidth(411);           // 411 µs – max SNR
  bioHub.setSampleRate(25);            // 25 samples / second
  bioHub.setLEDWidth(4);

  // ── BLE init ──────────────────────────────────────────────────────────────
  BLEDevice::init("HeartMonitor");
  BLEServer*  pServer  = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* pService = pServer->createService(BLEUUID(SERVICE_UUID), 20);

  pCharHR     = makeCharacteristic(pService, CHAR_HR_UUID);
  pCharOxy    = makeCharacteristic(pService, CHAR_OXY_UUID);
  pCharStatus = makeCharacteristic(pService, CHAR_STATUS_UUID);
  pCharPPG    = makeCharacteristic(pService, CHAR_PPG_UUID);

  pService->start();

  BLEAdvertising* pAdv = BLEDevice::getAdvertising();
  pAdv->addServiceUUID(SERVICE_UUID);
  pAdv->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("BLE advertising…");
}

// ─── loop ─────────────────────────────────────────────────────────────────────
void loop() {
  if (!deviceConnected) { delay(100); return; }

  unsigned long now = millis();

  // ── Read sensor (blocking ~40 ms at 25 Hz) ────────────────────────────────
  body = bioHub.readBpm();

  // ── PPG characteristic: raw IR value as uint16 little-endian, 25 Hz ───────
  if (now - lastPpgNotify >= PPG_INTERVAL_MS) {
    lastPpgNotify = now;

    // irValue is uint32 from MAX30101; top 16 significant bits fit uint16
    uint16_t irSample = (uint16_t)(body.irValue >> 2);   // scale to 0–65535

    uint8_t ppgBytes[2] = {
      (uint8_t)(irSample & 0xFF),
      (uint8_t)((irSample >> 8) & 0xFF)
    };
    pCharPPG->setValue(ppgBytes, 2);
    pCharPPG->notify();
  }

  // ── Biometric characteristics: HR / SpO2 / status, 1 Hz ──────────────────
  if (now - lastBioNotify >= BIO_INTERVAL_MS) {
    lastBioNotify = now;

    // HR
    String hrStr = String(body.heartRate);
    pCharHR->setValue(hrStr.c_str());
    pCharHR->notify();

    // SpO2
    String oxyStr = String(body.oxygen);
    pCharOxy->setValue(oxyStr.c_str());
    pCharOxy->notify();

    // Status / confidence
    String statusStr;
    switch (body.status) {
      case 0: statusStr = "No finger"; break;
      case 1: statusStr = "Low";       break;
      case 2: statusStr = "Medium";    break;
      case 3: statusStr = "High";      break;
      default:statusStr = "Unknown";   break;
    }
    pCharStatus->setValue(statusStr.c_str());
    pCharStatus->notify();

    Serial.printf("HR: %d  SpO2: %d  Status: %s  IR: %u\n",
      body.heartRate, body.oxygen, statusStr.c_str(), body.irValue);
  }
}
