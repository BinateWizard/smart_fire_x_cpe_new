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

        const dhtNode = data.dht || {};
        const mq2DoNode = data.mq2_do || {};
        const mq2Node = data.mq2 || {};
        let currentTemp = data.temperature;
        let currentHumidity = data.humidity;
        if (currentTemp === undefined && dhtNode.temperature !== undefined) currentTemp = dhtNode.temperature;
        if (currentHumidity === undefined && dhtNode.humidity !== undefined) currentHumidity = dhtNode.humidity;

        // Normalize smoke reading and detection flags for different schemas (legacy vs DEVICE_010)
        const rawSmokeAnalog =
          data.smokeLevel ||
          data.smoke ||
          data.smokeAnalog ||
          data.mq2 ||
          0;
        const smokeDetected =
          data.smokeDetected === true ||
          mq2DoNode.smokeDetected === true ||
          (String(mq2Node.status || '').toLowerCase() === 'smoke detected');

        const currentData = {
          id: Date.now(),
          dateTime: buttonStatus.lastEventAt
            ? new Date(buttonStatus.lastEventAt)
            : (data.lastSeen
              ? new Date(data.lastSeen)
              : (dhtNode.timestamp
                ? new Date(dhtNode.timestamp)
                : (mq2DoNode.timestamp
                  ? new Date(mq2DoNode.timestamp)
                  : (mq2Node.timestamp
                    ? new Date(mq2Node.timestamp)
                    : (data.timestamp ? new Date(data.timestamp) : new Date()))))),
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

        latest.value = currentData;
        loading.value = false;
        noData.value = false;
        lastUpdated.value = new Date();

        // Add current reading to allReadings if it's new (check by timestamp)
        const existingIndex = allReadings.findIndex(r => 
          Math.abs(r.dateTime - currentData.dateTime) < 1000 // within 1 second
        );
        
        if (existingIndex === -1) {
          allReadings.unshift(currentData); // Add to beginning
          if (allReadings.length > 500) allReadings.pop(); // Keep last 500
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
