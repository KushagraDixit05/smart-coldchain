/// Compares a reading against a shipment's stored thresholds and returns the
/// first breach found (a shipment could technically breach on multiple axes
/// at once; we record the most severe/first one and let the next reading
/// catch any other axis if it's still out of range).
function checkThresholds(reading, shipment) {
  const { temp, humidity, vibration } = reading;

  if (temp < shipment.temp_min || temp > shipment.temp_max) {
    return { breachType: "Temperature", measuredValue: temp };
  }
  if (humidity < shipment.humidity_min || humidity > shipment.humidity_max) {
    return { breachType: "Humidity", measuredValue: humidity };
  }
  if (vibration > shipment.vibration_max) {
    return { breachType: "Vibration", measuredValue: vibration };
  }
  return null;
}

module.exports = { checkThresholds };
