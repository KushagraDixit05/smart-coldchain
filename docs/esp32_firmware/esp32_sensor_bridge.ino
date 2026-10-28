/*
 * =====================================================
 * BKT PROJECT — ESP32 SENSOR BRIDGE FIRMWARE
 * =====================================================
 *
 * Sensors:
 *   DHT22    → GPIO 4      (Temperature & Humidity)
 *   SW-420   → GPIO 27     (Vibration – digital out)
 *   NEO-6M   → UART2 RX=16 TX=17  (GPS)
 *
 * Output:
 *   Sends a compact JSON object over Serial (115200 baud)
 *   every 2 seconds so the backend serial bridge can
 *   parse and forward it to the database + WebSocket.
 *
 * JSON shape:
 * {
 *   "temp":       25.3,        // degrees C  (null when sensor error)
 *   "humidity":   60.1,        // percent
 *   "vibration":  0,           // 0 = stable | 1 = vibration detected
 *   "gpsFix":     true,        // false until satellites acquired
 *   "lat":        28.613900,   // decimal degrees (0.0 when no fix)
 *   "lon":        77.209000,
 *   "altitude":   216.50,      // metres
 *   "satellites": 7,
 *   "ts":         1700000000   // seconds since boot (unix-ish)
 * }
 *
 * All non-JSON lines (boot banner, debug) are prefixed with
 * "//" so the backend bridge ignores them safely.
 *
 * Libraries required (install via Arduino Library Manager):
 *   - DHT sensor library  (Adafruit)
 *   - Adafruit Unified Sensor
 *
 * Board: ESP32 Dev Module
 * =====================================================
 */

#include <HardwareSerial.h>
#include <DHT.h>
#include <math.h>

// ─── Pin definitions ──────────────────────────────────────────────────────────
#define DHT_PIN       4
#define DHT_TYPE      DHT22
#define VIBRATION_PIN 27
#define GPS_RX_PIN    16
#define GPS_TX_PIN    17

// ─── Sensor objects ───────────────────────────────────────────────────────────
DHT dht(DHT_PIN, DHT_TYPE);
HardwareSerial GPS_SERIAL(2);   // UART2

// ─── GPS state ────────────────────────────────────────────────────────────────
String  _gpsLine   = "";
bool    gpsFix     = false;
double  latitude   = 0.0;
double  longitude  = 0.0;
double  altitude   = 0.0;
int     satellites = 0;

// ─── Timing ───────────────────────────────────────────────────────────────────
static unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL_MS = 2000;

// ─────────────────────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  dht.begin();
  pinMode(VIBRATION_PIN, INPUT);

  GPS_SERIAL.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  delay(2000);

  // Boot banner (prefixed with // so bridge ignores it)
  Serial.println();
  Serial.println("// ==========================================");
  Serial.println("//   BKT PROJECT - ESP32 SENSOR BRIDGE");
  Serial.println("// ==========================================");
  Serial.println("// DHT22      : GPIO 4");
  Serial.println("// SW-420     : GPIO 27");
  Serial.println("// GPS RX     : GPIO 16  (UART2)");
  Serial.println("// GPS TX     : GPIO 17  (UART2)");
  Serial.println("// Output     : JSON @ 115200 baud");
  Serial.println("// Interval   : 2 s");
  Serial.println("// ==========================================");
  Serial.println("// Waiting for sensors...");
  Serial.println();
}

// ─────────────────────────────────────────────────────────────────────────────
// GPS reader — called every loop iteration for non-blocking accumulation
// ─────────────────────────────────────────────────────────────────────────────
void readGPS() {
  while (GPS_SERIAL.available()) {
    char c = GPS_SERIAL.read();

    if (c == '\n') {
      _gpsLine.trim();

      if (_gpsLine.startsWith("$GPGGA") || _gpsLine.startsWith("$GNGGA")) {
        parseGGA(_gpsLine);
      }

      _gpsLine = "";
    } else if (c != '\r') {
      _gpsLine += c;
    }
  }
}

// ─── Parse NMEA GGA sentence ──────────────────────────────────────────────────
void parseGGA(String sentence) {
  String field[15];
  int fieldIndex = 0;
  int startIndex = 0;

  for (int i = 0; i <= (int)sentence.length(); i++) {
    if (i == (int)sentence.length() || sentence[i] == ',') {
      if (fieldIndex < 15) {
        field[fieldIndex] = sentence.substring(startIndex, i);
      }
      fieldIndex++;
      startIndex = i + 1;
    }
  }

  if (fieldIndex < 10) return;

  int fixQuality = field[6].toInt();
  satellites     = field[7].toInt();

  if (fixQuality > 0) {
    gpsFix = true;

    // Latitude
    double rawLat  = field[2].toDouble();
    int    latDeg  = (int)(rawLat / 100.0);
    double latMin  = rawLat - (latDeg * 100.0);
    latitude       = latDeg + (latMin / 60.0);
    if (field[3] == "S") latitude = -latitude;

    // Longitude
    double rawLon  = field[4].toDouble();
    int    lonDeg  = (int)(rawLon / 100.0);
    double lonMin  = rawLon - (lonDeg * 100.0);
    longitude      = lonDeg + (lonMin / 60.0);
    if (field[5] == "W") longitude = -longitude;

    // Altitude
    altitude = field[9].toDouble();

  } else {
    gpsFix    = false;
    latitude  = 0.0;
    longitude = 0.0;
    altitude  = 0.0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Emit one JSON frame to Serial
// ─────────────────────────────────────────────────────────────────────────────
void sendJSON() {
  float temperature = dht.readTemperature();
  float humidity    = dht.readHumidity();
  int   vibration   = digitalRead(VIBRATION_PIN);

  // Seconds since boot (backend uses server timestamp for DB; this is informational)
  unsigned long ts = millis() / 1000UL;

  // Build JSON manually — no ArduinoJson dependency needed
  Serial.print(F("{"));

  // Temperature
  Serial.print(F("\"temp\":"));
  if (isnan(temperature)) {
    Serial.print(F("null"));
  } else {
    Serial.print(temperature, 2);
  }

  // Humidity
  Serial.print(F(",\"humidity\":"));
  if (isnan(humidity)) {
    Serial.print(F("null"));
  } else {
    Serial.print(humidity, 2);
  }

  // Vibration (digital: 0 or 1)
  Serial.print(F(",\"vibration\":"));
  Serial.print(vibration);

  // GPS Fix flag
  Serial.print(F(",\"gpsFix\":"));
  Serial.print(gpsFix ? F("true") : F("false"));

  // Latitude
  Serial.print(F(",\"lat\":"));
  Serial.print(latitude, 6);

  // Longitude
  Serial.print(F(",\"lon\":"));
  Serial.print(longitude, 6);

  // Altitude
  Serial.print(F(",\"altitude\":"));
  Serial.print(altitude, 2);

  // Satellites
  Serial.print(F(",\"satellites\":"));
  Serial.print(satellites);

  // Timestamp
  Serial.print(F(",\"ts\":"));
  Serial.print(ts);

  Serial.println(F("}"));
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LOOP
// ─────────────────────────────────────────────────────────────────────────────
void loop() {
  // Continuously drain GPS UART buffer (non-blocking)
  readGPS();

  // Send a JSON frame every SEND_INTERVAL_MS
  unsigned long now = millis();
  if (now - lastSend >= SEND_INTERVAL_MS) {
    lastSend = now;
    sendJSON();
  }
}
