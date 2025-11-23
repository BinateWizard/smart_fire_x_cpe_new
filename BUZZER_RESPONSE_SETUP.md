# FireTap Buzzer Response System

## Overview
The buzzer response system allows users to remotely control a buzzer/relay connected to the ESP32 device by pressing the "🚑 Respond" button in the app. This creates a "beep beep beep" pattern to acknowledge the emergency response.

## System Architecture

### Communication Flow
```
User clicks "Respond" button in app
    ↓
App writes command to Firebase RTDB
    /devices/{DEVICE_ID}/command
    ↓
ESP32 listens via Firebase stream
    ↓
ESP32 controls buzzer relay pin
    ↓
Buzzer creates "beep beep beep" pattern
```

## Hardware Setup

### Required Components
- ESP32 development board
- Buzzer module or relay module
- Buzzer (if using relay)
- Jumper wires
- Optional: External power supply for buzzer

### Wiring Diagram

#### Option 1: Direct Buzzer Connection
```
ESP32 GPIO 25 ──► Buzzer (+)
GND          ──► Buzzer (-)
```

#### Option 2: Relay Module Connection (Recommended for loud buzzer)
```
ESP32 GPIO 25 ──► Relay IN
ESP32 VCC    ──► Relay VCC
ESP32 GND    ──► Relay GND

Relay COM    ──► Buzzer (+)
Relay NO     ──► Power Supply (+)
GND          ──► Buzzer (-)
```

### Pin Configuration
Default buzzer pin: **GPIO 25**

You can change this in the ESP32 code:
```cpp
#define BUZZER_PIN 25 // Change to your preferred GPIO pin
```

**Available GPIO pins on ESP32:**
- GPIO 25, 26, 27 (ADC2 - recommended)
- GPIO 32, 33 (ADC1)
- GPIO 2, 4, 5, 12-15, 18-19, 21-23

**Avoid these pins:**
- GPIO 0, 2, 15 (used for boot mode)
- GPIO 6-11 (connected to flash)
- GPIO 34-39 (input only, no output)

## Software Setup

### 1. Install ESP32 Arduino Code

1. **Open Arduino IDE**
2. **Load the sketch**: `ESP32_BUZZER_RESPOND.ino`
3. **Configure WiFi credentials**:
   ```cpp
   #define WIFI_SSID "YOUR_WIFI_SSID"
   #define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
   ```

4. **Configure Firebase credentials**:
   ```cpp
   #define API_KEY "YOUR_FIREBASE_API_KEY"
   #define DATABASE_URL "https://firetap-f2bcd-default-rtdb.firebaseio.com/"
   #define USER_EMAIL "YOUR_FIREBASE_USER_EMAIL"
   #define USER_PASSWORD "YOUR_FIREBASE_USER_PASSWORD"
   ```

5. **Set Device ID** (must match the ID you registered in the app):
   ```cpp
   #define DEVICE_ID "DEVICE_001" // Match your device ID
   ```

6. **Install required libraries**:
   - Go to **Sketch → Include Library → Manage Libraries**
   - Search and install:
     - `Firebase ESP Client` by Mobizt (latest version)

7. **Select board**: Tools → Board → ESP32 Arduino → ESP32 Dev Module
8. **Upload the code** to your ESP32

### 2. Test the Setup

After uploading:
1. Open **Serial Monitor** (115200 baud)
2. You should see:
   ```
   Connected to WiFi!
   ✅ Firebase Authentication OK
   ✅ Stream started successfully
   Listening for commands at: /devices/DEVICE_001/command
   Testing buzzer...
   BEEP!
   ```

3. If you hear a beep, the buzzer is working correctly!

## Using the System

### In the App

1. **Open your device** in the FireTap app
2. When an **alert is triggered** (smoke, fire, high temperature):
   - You'll see alert banners with a **"🚑 Respond" button**
3. **Click the "🚑 Respond" button**:
   - The app sends a command to the ESP32
   - The buzzer creates a "beep beep beep" pattern
   - The app navigates to the map view showing your device location

### Command Structure

The app sends this JSON to Firebase RTDB:
```json
{
  "type": "buzzer",
  "action": "beep",
  "pattern": "triple",
  "timestamp": 1732368000000
}
```

**Command fields:**
- `type`: "buzzer" (command type)
- `action`: "beep" (action to perform)
- `pattern`: "triple", "continuous", or "single"
- `timestamp`: Unix timestamp (prevents duplicate execution)

## Customization

### Change Beep Pattern

In `ESP32_BUZZER_RESPOND.ino`, modify these constants:

```cpp
#define BEEP_DURATION 200  // Duration of each beep (ms)
#define BEEP_PAUSE 150     // Pause between beeps (ms)
```

**Examples:**
- **Fast beeps**: `BEEP_DURATION 100`, `BEEP_PAUSE 100`
- **Slow beeps**: `BEEP_DURATION 500`, `BEEP_PAUSE 500`
- **Long beeps**: `BEEP_DURATION 1000`, `BEEP_PAUSE 200`

### Add Custom Patterns

In the app (`DeviceDetail.vue`), change the pattern:

```javascript
await set(buzzerCommandRef, {
  type: 'buzzer',
  action: 'beep',
  pattern: 'continuous', // 5 beeps instead of 3
  timestamp: Date.now()
});
```

In ESP32 code, add new pattern handler:

```cpp
if (pattern == "triple") {
  tripleBeep();
} else if (pattern == "continuous") {
  continuousBeep(5); // 5 beeps
} else if (pattern == "alarm") {
  // Add your custom alarm pattern
  for (int i = 0; i < 10; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    delay(50);
  }
} else {
  singleBeep();
}
```

## Troubleshooting

### Buzzer Not Working

**Problem**: No beep when pressing Respond button

**Solutions:**
1. **Check wiring**: Ensure buzzer is connected to correct GPIO pin
2. **Check Serial Monitor**: Look for "📨 New command received!" message
3. **Test buzzer manually**: You should hear a beep on ESP32 startup
4. **Check pin configuration**: Verify `BUZZER_PIN` matches your wiring
5. **Try different pin**: Some GPIO pins may not work depending on your board

### Command Not Received

**Problem**: Serial Monitor shows no command messages

**Solutions:**
1. **Check Firebase connection**: Serial should show "✅ Stream started successfully"
2. **Verify Device ID**: Must match exactly between app and ESP32
3. **Check Firebase rules**: Ensure authenticated users can read/write
4. **Check WiFi**: Ensure ESP32 is connected to internet
5. **Check authentication**: Serial should show "✅ Firebase Authentication OK"

### Multiple Beeps on Single Press

**Problem**: Buzzer beeps multiple times for one button press

**Solution**: This is prevented by timestamp checking. If it happens:
1. Command might not be deleted after execution
2. Check if `Firebase.RTDB.deleteNode()` is working
3. Ensure `lastCommandTimestamp` is updated correctly

### Buzzer Too Quiet

**Solutions:**
1. **Use external power**: Connect buzzer to external 5V/12V supply via relay
2. **Use active buzzer**: Active buzzers are louder than passive ones
3. **Add transistor/relay**: Don't drive buzzer directly from GPIO (limited current)

### Relay Not Switching

**Solutions:**
1. **Check relay voltage**: Ensure relay operates at 3.3V or 5V
2. **Check power**: Some relays need external 5V (connect to ESP32 VIN)
3. **Check logic level**: Use LOW for active-low relays
4. **Test with LED**: Replace buzzer with LED to verify output

## Security Considerations

### Firebase Rules

Ensure only authenticated users can write commands:

**RTDB Rules** (`database.rules.json`):
```json
{
  "rules": {
    "devices": {
      "$deviceId": {
        "command": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      }
    }
  }
}
```

### Command Validation

The ESP32 code validates:
- ✅ Command type must be "buzzer"
- ✅ Action must be "beep"
- ✅ Timestamp prevents duplicate execution
- ✅ Command is deleted after execution

## Advanced Features

### Add Multiple Command Types

Extend the system to control other devices:

**In app:**
```javascript
// Turn on sprinkler
await set(commandRef, {
  type: 'sprinkler',
  action: 'activate',
  duration: 30, // seconds
  timestamp: Date.now()
});
```

**In ESP32:**
```cpp
if (type == "buzzer") {
  // Handle buzzer
} else if (type == "sprinkler") {
  // Handle sprinkler
  int duration = 30;
  if (json.get(result, "duration")) {
    duration = result.intValue;
  }
  activateSprinkler(duration);
}
```

### Add Confirmation Response

Make ESP32 send acknowledgment:

```cpp
// After executing command
String responsePath = "/devices/" + String(DEVICE_ID) + "/response";
Firebase.RTDB.setString(&fbdo, responsePath.c_str(), "buzzer_executed");
```

In app, listen for response:
```javascript
const responseRef = dbRef(rtdb, `devices/${deviceId}/response`);
onValue(responseRef, (snapshot) => {
  if (snapshot.val() === 'buzzer_executed') {
    console.log('✅ ESP32 confirmed buzzer execution');
  }
});
```

## Testing Checklist

- [ ] ESP32 connects to WiFi successfully
- [ ] Firebase authentication successful
- [ ] Stream listener starts correctly
- [ ] Test beep on startup works
- [ ] Respond button appears in app during alert
- [ ] Clicking Respond button sends command
- [ ] ESP32 receives command (check Serial Monitor)
- [ ] Buzzer creates triple beep pattern
- [ ] Command is not executed multiple times
- [ ] Map view opens after responding

## Support

If you encounter issues:
1. **Check Serial Monitor** output on ESP32
2. **Check browser console** in the app (F12)
3. **Verify Firebase RTDB** at: https://console.firebase.google.com/project/firetap-f2bcd/database/data
4. **Check device path**: `/devices/{DEVICE_ID}/command`

## Code Files
- **Web App**: `src/views/DeviceDetail.vue` (handleRespond function)
- **ESP32**: `ESP32_BUZZER_RESPOND.ino`
- **Documentation**: This file

## License
Part of the FireTap project. Use and modify as needed.
