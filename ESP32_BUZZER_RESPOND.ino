#include <WiFi.h>
#include <HTTPClient.h>
#include "time.h"
#include "DHT.h"

// ================== WIFI & FIREBASE CONFIG ==================
const char* ssid = "ZTE_2.4G_cAabzE";
const char* password = "JKCh4gdT";

const char* FIREBASE_DATABASE_URL = "https://firetap-f2bcd-default-rtdb.asia-southeast1.firebasedatabase.app";

String DEVICE_ID = "DEVICE_010";

// ================== TIME CONFIG ==================
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 8 * 3600;
const int daylightOffset_sec = 0;

// ================== PIN CONFIG ==================
#define BUTTON_PIN 33
#define BUZZER_PIN 26
#define RELAY_SPRINKLER_PIN 27
#define DHT_PIN 4

// ==== MQ2 ADDITION ====
#define MQ2_DO_PIN 34   // Digital output pin only

// ================== DHT CONFIG ==================
#define DHTTYPE DHT22
DHT dht(DHT_PIN, DHTTYPE);

// ================== TIMING ==================
const unsigned long ALERT_THRESHOLD = 3000;
const unsigned long SPRINKLER_THRESHOLD = 6000;
const unsigned long RESET_MAX_DURATION = 1000;
const unsigned long DEBOUNCE_DELAY = 50;
const unsigned long DHT_SEND_INTERVAL = 2000;

// ==== MQ2 ADDITION ====
const unsigned long MQ2_SEND_INTERVAL = 2000;
unsigned long lastMq2SendMs = 0;

// ==== BUZZER RESPONSE ADDITION ====
const unsigned long COMMAND_CHECK_INTERVAL = 1000; // Check for commands every 1 second
unsigned long lastCommandCheckMs = 0;
unsigned long lastCommandTimestamp = 0; // Track last processed command timestamp
#define BEEP_DURATION 200 // Duration of each beep in milliseconds
#define BEEP_PAUSE 150 // Pause between beeps in milliseconds
#define BUZZER_ON_DURATION 5000 // Buzzer stays ON for 5 seconds after alert, then auto OFF

// Buzzer auto-off tracking
bool buzzerAutoOffActive = false;
unsigned long buzzerOnStartMs = 0;

// ================== STATE MACHINE ==================
enum SystemState { STATE_IDLE, STATE_ALERT, STATE_SPRINKLER };
SystemState systemState = STATE_IDLE;

// ================== BUTTON STATE ==================
int lastRawState = HIGH;
int lastStableState = HIGH;
int prevStableState = HIGH;
unsigned long lastChangeMs = 0;

bool pressInProgress = false;
unsigned long pressStartMs = 0;

bool alertTriggeredThisPress = false;
bool sprinklerTriggeredThisPress = false;

// ================== DHT TIMER ==================
unsigned long lastDhtSendMs = 0;

// ================== FORWARD DECLARATIONS ==================
void sendButtonEvent(const String &eventType, const String &details = "");
String stateToString(SystemState s);
String getISO8601Time();
bool sendToRTDB(const String &path, const String &jsonBody, const String &method = "POST");
String getFromRTDB(const String &path);
bool deleteFromRTDB(const String &path);
void setBuzzer(bool on);
void setSprinklerRelay(bool on);
void triggerAlert();
void triggerSprinkler();
void resetSystem();
void sendDhtData();

// ==== MQ2 ADDITION ====
void sendMq2Data();

// ==== BUZZER RESPONSE ADDITION ====
void checkForCommands();
void singleBeep();
void tripleBeep();
void continuousBeep(int count);

// ================== TIME UTILS ==================
String getISO8601Time() {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) return "";
    char buffer[30];
    strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%S+08:00", &timeinfo);
    return String(buffer);
}

// ================== RTDB HELPER ==================
bool sendToRTDB(const String &path, const String &jsonBody, const String &method) {
    if (WiFi.status() != WL_CONNECTED) return false;

    HTTPClient http;
    String url = String(FIREBASE_DATABASE_URL) + path + ".json";

    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    int httpResponseCode = (method == "PUT") ? http.PUT(jsonBody) : http.POST(jsonBody);

    http.end();
    return (httpResponseCode > 0 && httpResponseCode < 400);
}

// ================== RTDB GET HELPER ==================
String getFromRTDB(const String &path) {
    if (WiFi.status() != WL_CONNECTED) return "";

    HTTPClient http;
    String url = String(FIREBASE_DATABASE_URL) + path + ".json";

    http.begin(url);
    int httpResponseCode = http.GET();

    String response = "";
    if (httpResponseCode > 0 && httpResponseCode < 400) {
        response = http.getString();
    }

    http.end();
    return response;
}

// ================== RTDB DELETE HELPER ==================
bool deleteFromRTDB(const String &path) {
    if (WiFi.status() != WL_CONNECTED) return false;

    HTTPClient http;
    String url = String(FIREBASE_DATABASE_URL) + path + ".json";

    http.begin(url);
    int httpResponseCode = http.sendRequest("DELETE");

    http.end();
    return (httpResponseCode > 0 && httpResponseCode < 400);
}

// ================== STATE → STRING ==================
String stateToString(SystemState s) {
    switch (s) {
        case STATE_IDLE: return "idle";
        case STATE_ALERT: return "alert";
        case STATE_SPRINKLER: return "sprinkler";
        default: return "unknown";
    }
}

// ================== BUTTON EVENT ==================
void sendButtonEvent(const String &eventType, const String &details) {
    String timestamp = getISO8601Time();
    String basePath = "/devices/" + DEVICE_ID;

    String eventsPath = basePath + "/buttonEvents";
    String eventJson = "{";
    eventJson += "\"eventType\":\"" + eventType + "\",";
    eventJson += "\"state\":\"" + stateToString(systemState) + "\",";
    eventJson += "\"details\":\"" + details + "\",";
    eventJson += "\"timestamp\":\"" + timestamp + "\"";
    eventJson += "}";
    sendToRTDB(eventsPath, eventJson, "POST");

    String statusPath = basePath + "/status";
    String statusJson = "{";
    statusJson += "\"lastEventType\":\"" + eventType + "\",";
    statusJson += "\"state\":\"" + stateToString(systemState) + "\",";
    statusJson += "\"lastEventAt\":\"" + timestamp + "\"";
    statusJson += "}";
    sendToRTDB(statusPath, statusJson, "PUT");
}

// ================== HELPERS ==================
void setBuzzer(bool on) {
    digitalWrite(BUZZER_PIN, on ? LOW : HIGH);
}

void setSprinklerRelay(bool on) {
    digitalWrite(RELAY_SPRINKLER_PIN, on ? LOW : HIGH);
}

void triggerAlert() {
    if (systemState == STATE_IDLE) {
        systemState = STATE_ALERT;
        Serial.println("[ALERT] Turning buzzer ON for 5 seconds");
        digitalWrite(BUZZER_PIN, LOW); // Turn ON
        buzzerAutoOffActive = true;
        buzzerOnStartMs = millis();
        sendButtonEvent("alert", "3-second hold reached");
    }
}

void triggerSprinkler() {
    if (systemState != STATE_SPRINKLER) {
        systemState = STATE_SPRINKLER;
        setSprinklerRelay(true);
        sendButtonEvent("sprinkler", "6-second hold reached");
    }
}

void resetSystem() {
    Serial.println("🔄 RESET SYSTEM called");
    Serial.print("  Previous state: ");
    Serial.println(stateToString(systemState));
    Serial.print("  Buzzer auto-off active: ");
    Serial.println(buzzerAutoOffActive ? "YES" : "NO");
    
    systemState = STATE_IDLE;
    setBuzzer(false);
    setSprinklerRelay(false);
    buzzerAutoOffActive = false; // Reset auto-off flag
    
    Serial.println("  ✅ System reset to IDLE");
    Serial.println("  ✅ Buzzer OFF");
    Serial.println("  ✅ Auto-off deactivated");
    
    sendButtonEvent("reset", "quick press <=1s");
}

// ================== SEND DHT DATA ==================
void sendDhtData() {
    float h = dht.readHumidity();
    float t = dht.readTemperature();

    if (isnan(h) || isnan(t)) return;

    String timestamp = getISO8601Time();
    String path = "/devices/" + DEVICE_ID + "/dht";

    String json = "{";
    json += "\"temperature\":" + String(t, 1) + ",";
    json += "\"humidity\":" + String(h, 1) + ",";
    json += "\"timestamp\":\"" + timestamp + "\"";
    json += "}";
    sendToRTDB(path, json, "PUT");
}

// ================== SEND MQ2 DO DATA ==================
void sendMq2Data() {
    int raw = digitalRead(MQ2_DO_PIN);

    // If your module is active LOW, invert logic
    bool smokeDetected = (raw == HIGH);

    String smokeStatus = smokeDetected ? "no smoke" : "smoke detected";

    Serial.print("[MQ2] Status = ");
    Serial.println(smokeStatus);

    String timestamp = getISO8601Time();
    String path = "/devices/" + DEVICE_ID + "/mq2";

    String json = "{";
    json += "\"status\":\"" + smokeStatus + "\",";
    json += "\"timestamp\":\"" + timestamp + "\"";
    json += "}";

    sendToRTDB(path, json, "PUT");
}

// ================== BUZZER RESPONSE - CHECK COMMANDS ==================
void checkForCommands() {
    String commandPath = "/devices/" + DEVICE_ID + "/command";
    
    Serial.print("[COMMAND CHECK] Fetching from: ");
    Serial.println(commandPath);
    
    String response = getFromRTDB(commandPath);
    
    Serial.print("[COMMAND CHECK] Response: ");
    if (response == "" || response == "null") {
        Serial.println("(empty/null - no command)");
        return;
    }
    
    Serial.println("COMMAND FOUND!");
    Serial.println("\n📨 Command received from app!");
    Serial.println("Raw response: " + response);
    Serial.print("Response length: ");
    Serial.println(response.length());

    // Simple JSON parsing (for this simple structure)
    int typeIdx = response.indexOf("\"type\"");
    int actionIdx = response.indexOf("\"action\"");
    int patternIdx = response.indexOf("\"pattern\"");
    int timestampIdx = response.indexOf("\"timestamp\"");

    if (typeIdx == -1 || actionIdx == -1) {
        Serial.println("⚠️ Invalid command format");
        return;
    }

    // Extract type
    int typeStart = response.indexOf(":", typeIdx) + 2;
    int typeEnd = response.indexOf("\"", typeStart);
    String type = response.substring(typeStart, typeEnd);

    // Extract action
    int actionStart = response.indexOf(":", actionIdx) + 2;
    int actionEnd = response.indexOf("\"", actionStart);
    String action = response.substring(actionStart, actionEnd);

    // Extract pattern
    String pattern = "single";
    if (patternIdx != -1) {
        int patternStart = response.indexOf(":", patternIdx) + 2;
        int patternEnd = response.indexOf("\"", patternStart);
        pattern = response.substring(patternStart, patternEnd);
    }

    // Extract timestamp - use last 8 digits for uniqueness
    unsigned long timestamp = 0;
    if (timestampIdx != -1) {
        int timestampStart = response.indexOf(":", timestampIdx) + 1;
        int timestampEnd = response.indexOf(",", timestampStart);
        if (timestampEnd == -1) timestampEnd = response.indexOf("}", timestampStart);
        String timestampStr = response.substring(timestampStart, timestampEnd);
        timestampStr.trim();
        
        // JS timestamp is 13 digits in milliseconds
        // Take last 8 digits (modulo approach for better uniqueness)
        if (timestampStr.length() > 8) {
            timestampStr = timestampStr.substring(timestampStr.length() - 8);
        }
        timestamp = timestampStr.toInt();
    }

    Serial.println("📋 Command details:");
    Serial.println("  Type: " + type);
    Serial.println("  Action: " + action);
    Serial.println("  Pattern: " + pattern);
    Serial.println("  Timestamp: " + String(timestamp));
    Serial.println("  Last timestamp: " + String(lastCommandTimestamp));

    // Check if this is a different command (not a duplicate)
    bool isDifferent = (timestamp != lastCommandTimestamp);
    Serial.print("  Is different command: ");
    Serial.println(isDifferent ? "YES" : "NO");

    // Delete command immediately to prevent re-processing
    Serial.println("  🗑️ Deleting command from Firebase...");
    bool deleted = deleteFromRTDB(commandPath);
    Serial.print("  Delete result: ");
    Serial.println(deleted ? "SUCCESS" : "FAILED");

    // Process command if it's different from last one
    if (isDifferent) {
        Serial.println("✅ New command - executing...");
        lastCommandTimestamp = timestamp;

        // Execute buzzer command
        if (type == "buzzer" && action == "beep") {
            Serial.println("🔔 Executing respond command...");
            Serial.print("  Current system state: ");
            Serial.println(stateToString(systemState));

            // If system is in ALERT state, turn buzzer back ON
            if (systemState == STATE_ALERT) {
                Serial.println("\n  🔔 ===== TURNING BUZZER BACK ON =====");
                Serial.print("  Current pin state: ");
                Serial.println(digitalRead(BUZZER_PIN) == LOW ? "ON (LOW)" : "OFF (HIGH)");
                
                // Turn buzzer ON
                digitalWrite(BUZZER_PIN, LOW); // Turn ON (active LOW)
                delay(100); // Give relay time to switch
                
                Serial.print("  New pin state: ");
                Serial.println(digitalRead(BUZZER_PIN) == LOW ? "ON (LOW)" : "OFF (HIGH)");
                
                // Verify the pin is actually LOW
                if (digitalRead(BUZZER_PIN) == LOW) {
                    Serial.println("  ✅ BUZZER IS NOW ON!");
                } else {
                    Serial.println("  ❌ WARNING: Buzzer pin is not LOW!");
                }
                
                // Restart the 5-second timer
                buzzerAutoOffActive = true;
                buzzerOnStartMs = millis();
                Serial.print("  ⏰ Auto-OFF timer started at: ");
                Serial.println(millis());
                Serial.println("  ⏰ Will auto-OFF after 5 seconds");
                Serial.println("  ========================================\n");
            } else {
                Serial.println("  ⚠️ Not in ALERT state, cannot turn on buzzer");
                // Not in alert state, just do the beep pattern
                if (pattern == "triple") {
                    tripleBeep();
                } else if (pattern == "continuous") {
                    continuousBeep(5); // Beep 5 times
                } else {
                    singleBeep();
                }
            }

            Serial.println("✅ Respond command completed");
        }
    } else {
        Serial.println("⏭️ Command already processed (same timestamp - duplicate)");
        Serial.println("  💡 This might happen if you clicked Respond twice very quickly");
    }
}

// ================== BUZZER PATTERNS ==================
// Single beep
void singleBeep() {
    Serial.println("Single beep");
    digitalWrite(BUZZER_PIN, LOW);  // Turn ON (active LOW)
    delay(BEEP_DURATION);
    digitalWrite(BUZZER_PIN, HIGH); // Turn OFF
}

// Triple beep pattern (beep beep beep)
void tripleBeep() {
    Serial.println("🔔 Triple beep pattern");
    for (int i = 0; i < 3; i++) {
        Serial.print("  Beep ");
        Serial.println(i + 1);
        digitalWrite(BUZZER_PIN, LOW);  // Turn ON
        delay(BEEP_DURATION);
        digitalWrite(BUZZER_PIN, HIGH); // Turn OFF

        // Don't add pause after last beep
        if (i < 2) {
            delay(BEEP_PAUSE);
        }
    }
}

// Continuous beep pattern
void continuousBeep(int count) {
    Serial.print("🔔 Continuous beep (");
    Serial.print(count);
    Serial.println(" times)");

    for (int i = 0; i < count; i++) {
        Serial.print("  Beep ");
        Serial.println(i + 1);
        digitalWrite(BUZZER_PIN, LOW);  // Turn ON
        delay(BEEP_DURATION);
        digitalWrite(BUZZER_PIN, HIGH); // Turn OFF

        if (i < count - 1) {
            delay(BEEP_PAUSE);
        }
    }
}

// ================== SETUP ==================
void setup() {
    Serial.begin(115200);

    pinMode(BUTTON_PIN, INPUT_PULLUP);
    pinMode(BUZZER_PIN, OUTPUT);
    pinMode(RELAY_SPRINKLER_PIN, OUTPUT);

    // ==== MQ2 ADDITION ====
    pinMode(MQ2_DO_PIN, INPUT);

    setBuzzer(false);
    setSprinklerRelay(false);

    int initial = digitalRead(BUTTON_PIN);
    lastRawState = lastStableState = prevStableState = initial;

    dht.begin();

    Serial.println("Connecting to WiFi...");
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\n✅ Connected to WiFi!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
    delay(2000);

    sendButtonEvent("startup", "device booted");

    // Test buzzer on startup
    Serial.println("\n🔔 Testing buzzer on startup...");
    singleBeep();
    Serial.println("✅ Buzzer test complete");
    Serial.println("\n📡 Listening for commands from app...");
}

// ================== LOOP ==================
void loop() {
    unsigned long now = millis();
    int raw = digitalRead(BUTTON_PIN);

    // ---- Debounce ----
    if (raw != lastRawState) {
        lastChangeMs = now;
        lastRawState = raw;
    }

    if ((now - lastChangeMs) > DEBOUNCE_DELAY && raw != lastStableState) {
        prevStableState = lastStableState;
        lastStableState = raw;

        if (prevStableState == HIGH && lastStableState == LOW) {
            pressInProgress = true;
            pressStartMs = now;
            alertTriggeredThisPress = false;
            sprinklerTriggeredThisPress = false;
        }

        if (prevStableState == LOW && lastStableState == HIGH && pressInProgress) {
            pressInProgress = false;
            unsigned long duration = now - pressStartMs;

            Serial.print("[BUTTON] Button released after ");
            Serial.print(duration);
            Serial.print("ms, system state: ");
            Serial.print(stateToString(systemState));
            Serial.print(", duration <= ");
            Serial.print(RESET_MAX_DURATION);
            Serial.print(": ");
            Serial.println(duration <= RESET_MAX_DURATION ? "YES" : "NO");

            if (duration <= RESET_MAX_DURATION && systemState != STATE_IDLE) {
                Serial.println("  ✅ Conditions met - calling resetSystem()");
                resetSystem();
            } else {
                if (systemState == STATE_IDLE) {
                    Serial.println("  ⚠️ Already in IDLE state - no reset needed");
                }
                if (duration > RESET_MAX_DURATION) {
                    Serial.println("  ⚠️ Press too long for reset (>1000ms)");
                }
            }
        }
    }

    // ---- Check thresholds ----
    if (pressInProgress && lastStableState == LOW) {
        unsigned long held = now - pressStartMs;

        if (!alertTriggeredThisPress && held >= ALERT_THRESHOLD) {
            alertTriggeredThisPress = true;
            triggerAlert();
        }

        if (!sprinklerTriggeredThisPress && held >= SPRINKLER_THRESHOLD) {
            sprinklerTriggeredThisPress = true;
            triggerSprinkler();
        }
    }

    // ---- AUTO TURN OFF BUZZER AFTER 5 SECONDS ----
    if (buzzerAutoOffActive && (now - buzzerOnStartMs >= BUZZER_ON_DURATION)) {
        buzzerAutoOffActive = false;
        
        if (systemState == STATE_ALERT) {
            Serial.println("\n⏰ ===== 5 SECONDS PASSED - AUTO OFF =====");
            Serial.print("  Buzzer state BEFORE: ");
            Serial.println(digitalRead(BUZZER_PIN) == LOW ? "ON" : "OFF");
            
            digitalWrite(BUZZER_PIN, HIGH); // Turn OFF
            delay(10);
            
            Serial.print("  Buzzer state AFTER: ");
            Serial.println(digitalRead(BUZZER_PIN) == LOW ? "ON" : "OFF");
            Serial.println("  ✅ Buzzer auto-OFF complete");
            Serial.println("  💡 Click 'Respond' in app to turn it back ON");
            Serial.println("========================================\n");
        }
    }

    // ---- DHT SEND ----
    if (now - lastDhtSendMs >= DHT_SEND_INTERVAL) {
        lastDhtSendMs = now;
        sendDhtData();
    }

    // ---- MQ2 SEND ----
    if (now - lastMq2SendMs >= MQ2_SEND_INTERVAL) {
        lastMq2SendMs = now;
        sendMq2Data();
    }

    // ---- CHECK FOR COMMANDS (BUZZER RESPONSE) ----
    if (now - lastCommandCheckMs >= COMMAND_CHECK_INTERVAL) {
        lastCommandCheckMs = now;
        
        // Debug: Print current state periodically if in alert
        static unsigned long lastDebugMs = 0;
        if (systemState == STATE_ALERT && (now - lastDebugMs >= 5000)) {
            lastDebugMs = now;
            Serial.print("[DEBUG] In ALERT state, buzzer pin: ");
            Serial.print(digitalRead(BUZZER_PIN));
            Serial.print(", auto-off active: ");
            Serial.print(buzzerAutoOffActive ? "YES" : "NO");
            Serial.print(", checking for commands now...");
            Serial.println();
        }
        
        checkForCommands();
    }

    delay(5);
}
