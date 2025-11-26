import { ref, onUnmounted } from 'vue';
import { ref as dbRef, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import { rtdb } from '@/firebase';
import { stopAllAlerts } from '@/services/alertMonitor';

function determineStatus(data) {
  if (!data || typeof data !== 'object') return 'Safe';
  const toStr = v => String(v || '').toLowerCase();
  if (data.sensorError === true) return 'Alert';
  if (data.message === 'help requested' || data.message === 'alarm has been triggered') return 'Alert';
  if (data.lastType === 'alarm') return 'Alert';
  const gas = toStr(data.gasStatus);
  if (['critical','detected'].includes(gas)) return 'Alert';
  // Smoke status: rely on digital flags (smokeDetected / mq2_do.smokeDetected)
  const smokeDetectedFlag =
    data.smokeDetected === true ||
    (data.mq2_do && data.mq2_do.smokeDetected === true) ||
    (data.mq2 && toStr(data.mq2.status) === 'smoke detected');
  if (smokeDetectedFlag) return 'Smoke Detected';
  return 'Safe';
}

function determineStatusFromButton(data, buttonEvent) {
  if (buttonEvent === 'STATE_ALERT') return 'Alert';
  if (buttonEvent === 'STATE_SPRINKLER') return 'Safe';
  return determineStatus(data);
}

export function useDeviceController(deviceIdRef) {
  const latest = ref(null);
  const history = ref([]);
  const statusCards = ref([]);
  const loading = ref(true);
  const noData = ref(false);
  const lastUpdated = ref(null);
  let mainUnsub = null;
  let statusUnsub = null;
  let readingsUnsub = null;
  const allReadings = [];
  
  // Track previous state to detect changes
  let previousState = {
    status: null,
    temperature: null,
    smokeDetected: null,
    buttonEvent: null,
    sprinklerActive: null
  };
  
  // Load persisted history from localStorage
  function loadPersistedHistory(deviceId) {
    try {
      const key = `firetap_history_${deviceId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert ISO strings back to Date objects
        return parsed.map(entry => ({
          ...entry,
          dateTime: new Date(entry.dateTime)
        }));
      }
    } catch (err) {
      console.error('Failed to load persisted history:', err);
    }
    return [];
  }
  
  // Save history to localStorage
  function saveHistoryToStorage(deviceId, historyData) {
    try {
      const key = `firetap_history_${deviceId}`;
      // Keep only last 500 entries to avoid storage limits
      const toSave = historyData.slice(0, 500);
      localStorage.setItem(key, JSON.stringify(toSave));
    } catch (err) {
      console.error('Failed to save history:', err);
    }
  }

  function start() {
    const deviceId = deviceIdRef.value;
    loading.value = true;
    noData.value = false;
    
    // Load persisted history and populate allReadings
    const persisted = loadPersistedHistory(deviceId);
    if (persisted.length > 0) {
      allReadings.push(...persisted);
      history.value = persisted;
    }

    // Listen to readings path for all historical data
    const readingsRef = dbRef(rtdb, `devices/${deviceId}/readings`);
    readingsUnsub = onValue(readingsRef, readingsSnapshot => {
      if (readingsSnapshot.exists()) {
        const readingsData = readingsSnapshot.val();
        const readingsArr = Object.entries(readingsData).map(([key, value]) => {
          const dht = value.dht || {};
          const mq2Do = value.mq2_do || {};
          const mq2Node = value.mq2 || {};
          const temp = value.temperature !== undefined ? value.temperature : dht.temperature;
          const humidity = value.humidity !== undefined ? value.humidity : dht.humidity;
          const smokeAnalog = value.smokeLevel || value.smoke || value.smokeAnalog || value.mq2 || 0;
          const smokeDetected =
            value.smokeDetected === true ||
            mq2Do.smokeDetected === true ||
            (String(mq2Node.status || '').toLowerCase() === 'smoke detected');
          
          const buttonStatus = value.status || {};
          const buttonState = buttonStatus.state || 'idle';
          let buttonEventState = 'STATE_IDLE';
          if (buttonState === 'alert') buttonEventState = 'STATE_ALERT';
          else if (buttonState === 'sprinkler') buttonEventState = 'STATE_SPRINKLER';
          
          return {
            id: key,
            dateTime: value.lastSeen
              ? new Date(value.lastSeen)
              : (value.timestamp
                ? new Date(value.timestamp)
                : (mq2Node.timestamp
                  ? new Date(mq2Node.timestamp)
                  : new Date())),
            smokeAnalog,
            smokeDetected,
            gasStatus: value.gasStatus || 'normal',
            temperature: temp,
            humidity: humidity,
            message: value.message || (value.sensorError === true ? 'Sensor Error' : ''),
            sensorError: value.sensorError === true,
            sprinklerActive: value.sprinklerActive === true || buttonEventState === 'STATE_SPRINKLER',
            buttonEvent: buttonEventState,
            buttonState,
            lastType: value.lastType,
            status: determineStatusFromButton(value, buttonEventState)
          };
        });
        
        // Update history with readings data
        const merged = [...readingsArr, ...allReadings];
        const uniqueMap = new Map();
        merged.forEach(entry => {
          const timeKey = entry.dateTime.getTime();
          if (!uniqueMap.has(timeKey)) {
            uniqueMap.set(timeKey, entry);
          }
        });
        
        history.value = Array.from(uniqueMap.values())
          .sort((a, b) => b.dateTime - a.dateTime)
          .slice(0, 500);
        
        // Persist to localStorage
        saveHistoryToStorage(deviceId, history.value);
      }
    });

    const deviceDataRef = dbRef(rtdb, `devices/${deviceId}`);
    mainUnsub = onValue(deviceDataRef, snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const sensorErrorFlag = (data.sensorError === true);
        const sprinklerActiveFlag = (data.sprinklerActive === true);
        const buttonStatus = data.status || {};
        const buttonState = buttonStatus.state || 'idle';
        let buttonEventState = 'STATE_IDLE';
        if (buttonState === 'alert') buttonEventState = 'STATE_ALERT';
        else if (buttonState === 'sprinkler') buttonEventState = 'STATE_SPRINKLER';

        let buttonMessage = '';
        if (buttonEventState === 'STATE_ALERT') buttonMessage = 'alert triggered';
        else if (buttonEventState === 'STATE_SPRINKLER') buttonMessage = 'sprinkler activated';

        // Read from dht and mq2 nodes (DEVICE_010 structure)
        const dhtNode = data.dht || {};
        const mq2Node = data.mq2 || {};
        
        // Temperature and humidity from dht node
        let currentTemp = dhtNode.temperature !== undefined ? dhtNode.temperature : data.temperature;
        let currentHumidity = dhtNode.humidity !== undefined ? dhtNode.humidity : data.humidity;

        // Smoke detection from mq2 node status field
        const mq2Status = String(mq2Node.status || '').toLowerCase();
        const smokeDetected = 
          mq2Status === 'smoke detected' || 
          data.smokeDetected === true;
        
        // Smoke analog value (if available, otherwise 0)
        const rawSmokeAnalog = data.smokeLevel || data.smoke || data.smokeAnalog || 0;

        // Use most recent timestamp from dht or mq2 nodes
        let latestTimestamp = new Date();
        if (dhtNode.timestamp) latestTimestamp = new Date(dhtNode.timestamp);
        else if (mq2Node.timestamp) latestTimestamp = new Date(mq2Node.timestamp);
        else if (data.timestamp) latestTimestamp = new Date(data.timestamp);
        
        const currentData = {
          id: Date.now(),
          dateTime: latestTimestamp,
          smokeAnalog: rawSmokeAnalog,
          gasStatus: data.gasStatus || 'normal',
          temperature: currentTemp,
          humidity: currentHumidity,
          message: buttonMessage || data.message || (sensorErrorFlag ? 'Sensor Error' : ''),
          sensorError: sensorErrorFlag,
          sprinklerActive: sprinklerActiveFlag || buttonEventState === 'STATE_SPRINKLER',
          buttonEvent: buttonEventState,
          buttonState,
          lastType: data.lastType,
          smokeDetected,
          status: determineStatusFromButton(data, buttonEventState)
        };
        
        console.log('🔥 Current data parsed:', {
          temperature: currentTemp,
          humidity: currentHumidity,
          smokeDetected,
          mq2Status: mq2Node.status,
          timestamp: latestTimestamp
        });

        latest.value = currentData;
        loading.value = false;
        noData.value = false;
        lastUpdated.value = new Date();

        // Detect state changes and create new log entry
        const hasStateChanged = 
          previousState.status !== currentData.status ||
          previousState.buttonEvent !== currentData.buttonEvent ||
          previousState.sprinklerActive !== currentData.sprinklerActive ||
          previousState.smokeDetected !== currentData.smokeDetected ||
          (previousState.temperature < 50 && currentData.temperature >= 50) || // Entered high temp
          (previousState.temperature >= 50 && currentData.temperature < 50);   // Exited high temp
        
        console.log('🔄 State change check:', {
          hasChanged: hasStateChanged,
          previous: previousState,
          current: {
            status: currentData.status,
            buttonEvent: currentData.buttonEvent,
            temperature: currentData.temperature,
            smokeDetected: currentData.smokeDetected
          }
        });

        // Only add to history if state changed OR it's the first reading
        if (hasStateChanged || previousState.status === null) {
          const existingIndex = allReadings.findIndex(r => 
            Math.abs(r.dateTime - currentData.dateTime) < 1000 // within 1 second
          );
          
          if (existingIndex === -1) {
            allReadings.unshift(currentData); // Add to beginning
            if (allReadings.length > 500) allReadings.pop(); // Keep last 500
            console.log('✅ New log entry created:', currentData.status, currentData.temperature);
          }
          
          // Update previous state
          previousState = {
            status: currentData.status,
            temperature: currentData.temperature,
            smokeDetected: currentData.smokeDetected,
            buttonEvent: currentData.buttonEvent,
            sprinklerActive: currentData.sprinklerActive
          };
        }

        // Build history from stored readings path AND current updates
        if (data.readings && typeof data.readings === 'object') {
          const readingsArr = Object.entries(data.readings).map(([key, value]) => {
            const dht = value.dht || {};
            const mq2Do = value.mq2_do || {};
            const mq2Node = value.mq2 || {};
            const temp = value.temperature !== undefined ? value.temperature : dht.temperature;
            const humidity = value.humidity !== undefined ? value.humidity : dht.humidity;
            const smokeAnalog = value.smokeLevel || value.smoke || value.smokeAnalog || value.mq2 || 0;
            const smokeDetected =
              value.smokeDetected === true ||
              mq2Do.smokeDetected === true ||
              (String(mq2Node.status || '').toLowerCase() === 'smoke detected');
            
            const buttonStatus = value.status || {};
            const buttonState = buttonStatus.state || 'idle';
            let buttonEventState = 'STATE_IDLE';
            if (buttonState === 'alert') buttonEventState = 'STATE_ALERT';
            else if (buttonState === 'sprinkler') buttonEventState = 'STATE_SPRINKLER';
            
            return {
              id: key,
              dateTime: value.lastSeen
                ? new Date(value.lastSeen)
                : (value.timestamp
                  ? new Date(value.timestamp)
                  : (mq2Node.timestamp
                    ? new Date(mq2Node.timestamp)
                    : new Date())),
              smokeAnalog,
              smokeDetected,
              gasStatus: value.gasStatus || 'normal',
              temperature: temp,
              humidity: humidity,
              message: value.message || (value.sensorError === true ? 'Sensor Error' : ''),
              sensorError: value.sensorError === true,
              sprinklerActive: value.sprinklerActive === true || buttonEventState === 'STATE_SPRINKLER',
              buttonEvent: buttonEventState,
              buttonState,
              lastType: value.lastType,
              status: determineStatusFromButton(value, buttonEventState)
            };
          });
          
          // Merge readings from RTDB with live updates
          const allEntries = [...readingsArr, ...allReadings];
          const uniqueMap = new Map();
          allEntries.forEach(entry => {
            const timeKey = entry.dateTime.getTime();
            if (!uniqueMap.has(timeKey)) {
              uniqueMap.set(timeKey, entry);
            }
          });
          
          history.value = Array.from(uniqueMap.values())
            .sort((a, b) => b.dateTime - a.dateTime)
            .slice(0, 500);
          
          // Persist to localStorage
          saveHistoryToStorage(deviceId, history.value);
        } else {
          // No readings in RTDB, use live updates only
          history.value = [...allReadings];
          saveHistoryToStorage(deviceId, history.value);
        }
      } else {
        loading.value = false;
        noData.value = true;
        latest.value = null;
        history.value = [];
      }
    }, err => {
      console.error('Device listener error', err);
      loading.value = false;
      noData.value = true;
    });

    // Status history listener
    const statusHistoryRef = query(
      dbRef(rtdb, `devices/${deviceId}/statusHistory`),
      orderByChild('timestamp'),
      limitToLast(5)
    );
    statusUnsub = onValue(statusHistoryRef, snap => {
      if (!snap.exists()) {
        statusCards.value = [];
        return;
      }
      const obj = snap.val() || {};
      const arr = Object.entries(obj).map(([id,v]) => ({
        id,
        dateTime: v.timestamp ? new Date(v.timestamp) : new Date(),
        smokeAnalog: v.smokeLevel !== undefined ? v.smokeLevel : 0,
        gasStatus: v.gasStatus || 'normal',
        temperature: v.temperature,
        humidity: v.humidity,
        message: v.message || 'Alert',
        sensorError: false,
        lastType: 'alarm',
        status: 'Alert'
      })).sort((a,b) => b.dateTime - a.dateTime);
      statusCards.value = arr;
    });
  }

  function stop() {
    if (mainUnsub) { mainUnsub(); mainUnsub = null; }
    if (statusUnsub) { statusUnsub(); statusUnsub = null; }
    if (readingsUnsub) { readingsUnsub(); readingsUnsub = null; }
    stopAllAlerts(); // ensure cleanup if leaving page
  }

  onUnmounted(() => stop());

  return { latest, history, statusCards, loading, noData, lastUpdated, start, stop };
}
