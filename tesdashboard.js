const mqtt = require('mqtt')

// Sesuaikan dengan konfigurasi kamu
const MQTT_HOST     = '511fe9a7fee54db288deaa763f691cc5.s1.eu.hivemq.cloud' // ganti!
const MQTT_USERNAME = 'esp32user'   // ganti!
const MQTT_PASSWORD = 'Password123' // ganti!
const MQTT_TOPIC    = 'listrik/rumah'

const client = mqtt.connect(`mqtts://${MQTT_HOST}:8883`, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
})

client.on('connect', () => {
  console.log('Terhubung ke HiveMQ!')
  let count = 0

  const interval = setInterval(() => {
    count++

    // Simulasi data listrik yang realistis
    const tegangan  = +(218 + Math.random() * 6).toFixed(1)
    const arus      = +(0.5 + Math.random() * 3).toFixed(2)
    const daya      = +(tegangan * arus * 0.85).toFixed(1)
    const energi    = +(0.05 + count * 0.001).toFixed(3)
    const frekuensi = +(49.8 + Math.random() * 0.4).toFixed(1)
    const pf        = +(0.82 + Math.random() * 0.08).toFixed(2)

    const payload = JSON.stringify({ tegangan, arus, daya, energi, frekuensi, pf })

    client.publish(MQTT_TOPIC, payload)
    console.log(`[${count}/100] ${payload}`)

    if (count >= 100) {
      clearInterval(interval)
      client.end()
      console.log('\n✅ Selesai! 100 data terkirim.')
    }
  }, 1000) // kirim tiap 0.5 detik
})

client.on('error', (err) => {
  console.error('Error:', err.message)
})