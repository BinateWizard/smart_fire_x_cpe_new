# Device Registration & Dashboard Troubleshooting Guide

## Quick Check: Is Your ESP32 Sending Data?

### 1. Verify RTDB Has Data
Go to Firebase Console → Realtime Database:
https://console.firebase.google.com/project/firetap-f2bcd/database/data

You should see:
```
/devices
  /DEVICE_001
    timestamp: 1731896400000
    smokeLevel: 1200
    temperature: 27.5
    humidity: 65.2
    gasStatus: "normal"
    message: "safe"
```

### 2. Add Device to Your App

1. **Open the app** and sign in
2. **Click "Add New Device"** button on home page
3. **Enter Device ID**: `DEVICE_001` (exactly as it appears in RTDB)
4. **Enter Device Name**: "Kitchen Sensor" (or any friendly name)
5. **Click "Add Device"**

If you see error:
- ✅ "Device ID is already registered" → Device was added before, just go to home and click it
- ❌ "Device DEVICE_001 not found in Realtime Database" → ESP32 is not sending data or using different ID

### 3. View Device Dashboard

After adding device:
1. Home page will show "Kitchen Sensor" card
2. Click the card to open device dashboard
3. You should see:
   - Status circle (Safe/Alert)
   - Current time/date
   - Smoke level bar
   - Gas status
   - Recent history

If you see "Device Offline":
- ESP32 is not connected or stopped sending data
- Check Serial Monitor for "Sent periodic reading" messages
- Verify WiFi connection on ESP32

### 4. Test Real-Time Updates

While viewing the device dashboard:
1. **Breathe near the smoke sensor** or **trigger high smoke**
2. Dashboard should update automatically (no refresh needed!)
3. Status should change from "Safe" to "Alert"
4. Smoke level bar should increase
5. Notifications tab should appear in bottom nav with a badge

### 5. Check Browser Console

Open DevTools (F12) → Console tab:
- Look for: `📦 Raw RTDB data:` → shows what ESP32 is sending
- Look for: `✅ Device data updated at:` → confirms real-time listener is working
- If you see errors, copy and share them

## Common Issues & Fixes

### Issue: "Missing or insufficient permissions"
**Fix:** Apply Firebase security rules (see previous instructions)
- Firestore rules: allow authenticated users
- RTDB rules: allow authenticated users
- Make sure you're signed in to the app

### Issue: "Device not found in Realtime Database"
**Fix:** 
1. Check ESP32 Serial Monitor for "Auth OK" and "Sent periodic reading"
2. Verify `DEVICE_ID` in ESP32 code matches what you entered
3. Check RTDB console to see actual path: `/devices/DEVICE_001`

### Issue: Dashboard shows "Device Offline"
**Fix:**
1. ESP32 might be disconnected
2. Check RTDB path is correct: `/devices/{your-device-id}`
3. Verify RTDB rules allow read access for authenticated users

### Issue: No real-time updates
**Fix:**
1. Check browser console for errors
2. Verify databaseURL in `src/firebase.js` is correct
3. Make sure ESP32 is sending data every 30 seconds

### Issue: Smoke/gas values are wrong
**Fix:**
- ESP32 sends `smokeLevel` (0-4095) → app converts to percentage
- ESP32 sends `gasStatus` ("normal" or "detected")
- Check raw data in browser console: `📦 Raw RTDB data:`

## Testing Checklist

- [ ] Firebase rules applied (Firestore + RTDB)
- [ ] Signed in with Google account
- [ ] ESP32 shows "Auth OK" in Serial Monitor
- [ ] ESP32 shows "Sent periodic reading" every 30 seconds
- [ ] RTDB console shows `/devices/DEVICE_001` node with data
- [ ] Device added successfully in app (no error)
- [ ] Device appears on home page
- [ ] Device dashboard loads with current data
- [ ] Real-time updates work (data changes automatically)
- [ ] Notifications tab appears when smoke > 1500

## ESP32 Device ID Configuration

In your ESP32 code, make sure:
```cpp
const char* DEVICE_ID = "DEVICE_001"; // Must match exactly
```

When adding device in app, use the **exact same ID**: `DEVICE_001`

## Need Help?

Check browser console (F12) for:
- `📦 Raw RTDB data:` → shows ESP32 data structure
- `✅ Device data updated at:` → confirms updates working
- Red error messages → copy and share

Check ESP32 Serial Monitor for:
- `Connected to WiFi!` → WiFi OK
- `Auth OK` → Firebase auth OK
- `Sent periodic reading` → Data sent successfully
