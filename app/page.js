'use client'

import { useEffect, useState, useRef } from 'react'
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

// ============================================================
// KONFIGURASI — SESUAIKAN DENGAN HIVEMQ KAMU
// ============================================================
const MQTT_HOST     = '511fe9a7fee54db288deaa763f691cc5.s1.eu.hivemq.cloud' // ganti!
const MQTT_PORT     = 8884
const MQTT_USERNAME = 'esp32user'   // ganti!
const MQTT_PASSWORD = 'Password123' // ganti!
const MQTT_TOPIC    = 'Smart Home'
// ============================================================

// ── Gauge Setengah Lingkaran ─────────────────────────────────
// ── Gauge Setengah Lingkaran (Diperbarui) ────────────────────
function GaugeCard({ label, value, unit, min, max, color }) {
  const safeValue = value !== null && value !== undefined ? Number(value) : null
  
  // Hitung persentase riil (0 sampai 100)
  const pct = safeValue !== null
    ? Math.min(Math.max(((safeValue - min) / (max - min)) * 100, 0), 100)
    : 0

  const r = 65, cx = 90, cy = 88
  
  // Menggunakan circumference (keliling) untuk SVG dash array (lebih presisi & anti-bug)
  const circumference = Math.PI * r
  const dashoffset = circumference - (pct / 100) * circumference

  const colorMap = {
    blue: '#38bdf8', green: '#4ade80', yellow: '#facc15', red: '#f87171'
  }
  const stroke = colorMap[color] || '#38bdf8'
  const glowId = `glow-${label}`

  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex flex-col items-center">
      <span className="text-gray-400 text-xs font-semibold tracking-widest uppercase mb-1">
        {label}
      </span>
      <svg width="180" height="115" viewBox="0 0 180 115">
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        
        {/* Track (Latar Belakang Arc) */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#1f2937" strokeWidth="10" strokeLinecap="round"
        />
        
        {/* Arc Berwarna (Berdasarkan Nilai Aktual) */}
        {safeValue !== null && pct > 0 && (
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none" 
            stroke={stroke} 
            strokeWidth="10"
            strokeLinecap="round" 
            filter={`url(#${glowId})`}
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            className="transition-all duration-500 ease-in-out" // Tambahan animasi agar pergerakan smooth
          />
        )}
        
        {/* Teks Nilai */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="white"
          fontSize="26" fontWeight="700" fontFamily="monospace">
          {safeValue !== null ? safeValue : '—'}
        </text>
        
        {/* Satuan */}
        <text x={cx} y={cy + 16} textAnchor="middle"
          fill="#6b7280" fontSize="13" fontWeight="500">
          {unit}
        </text>
        
        {/* Teks Min Max */}
        <text x={cx - r + 6} y={cy + 22} textAnchor="middle"
          fill="#374151" fontSize="9">{min}</text>
        <text x={cx + r - 6} y={cy + 22} textAnchor="middle"
          fill="#374151" fontSize="9">{max}</text>
      </svg>
    </div>
  )
}

// ── Kartu Stat ───────────────────────────────────────────────
function StatCard({ label, value, unit, colorClass, icon, sub }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 flex flex-col gap-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-500 text-xs font-semibold tracking-widest uppercase">
          {label}
        </span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className={`text-3xl font-bold font-mono ${colorClass}`}>
          {value ?? '—'}
        </span>
        {unit && <span className="text-gray-500 text-sm mb-1">{unit}</span>}
      </div>
      {sub && <span className="text-gray-600 text-xs mt-1">{sub}</span>}
    </div>
  )
}

// ── Badge Status ─────────────────────────────────────────────
function StatusBadge({ status }) {
  const config = {
    connecting: { color: 'bg-yellow-500', text: 'Menghubungkan...', pulse: true },
    online:     { color: 'bg-green-400',  text: 'Online',           pulse: true },
    offline:    { color: 'bg-red-500',    text: 'Offline',          pulse: false },
  }
  const c = config[status] || config.connecting
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${c.color} ${c.pulse ? 'animate-pulse' : ''}`} />
      <span className={`text-sm font-medium ${
        status === 'online' ? 'text-green-400' :
        status === 'offline' ? 'text-red-400' : 'text-yellow-400'
      }`}>{c.text}</span>
    </div>
  )
}

// ── Custom Tooltip Chart ─────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono font-bold">
          {p.name}: {p.value} {p.unit}
        </p>
      ))}
    </div>
  )
}

// ── Halaman Utama ─────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData]           = useState(null)
  const [history, setHistory]     = useState([])
  const [status, setStatus]       = useState('connecting')
  const [lastUpdate, setLastUpdate] = useState(null)
  const [msgCount, setMsgCount]   = useState(0)
  const clientRef = useRef(null)

  useEffect(() => {
    let client = null

  import('mqtt').then((mqttLib) => {
    const mqtt = mqttLib.default || mqttLib
    client = mqtt.connect(`wss://${MQTT_HOST}:${MQTT_PORT}/mqtt`, {
        username: MQTT_USERNAME,
        password: MQTT_PASSWORD,
        clientId: 'dashboard-' + Math.random().toString(16).slice(2),
        reconnectPeriod: 3000,
        keepalive: 30,
      })

      clientRef.current = client

      client.on('connect', () => {
        setStatus('online')
        client.subscribe(MQTT_TOPIC)
      })

      client.on('message', (topic, message) => {
        try {
          const newRow = JSON.parse(message.toString())
          const now = new Date()

          setData(newRow)
          setLastUpdate(now)
          setMsgCount(prev => prev + 1)

          const timeStr = now.toLocaleTimeString('id-ID', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          })

          setHistory(prev => {
            const updated = [...prev, {
              time: timeStr,
              daya:     newRow.daya     != null ? +Number(newRow.daya).toFixed(1)     : 0,
            }]
            return updated.slice(-30)
          })
        } catch (e) {
          console.error('Gagal parse JSON:', e)
        }
      })

      client.on('error', (err) => {
        console.error('MQTT error:', err)
        setStatus('offline')
      })

      client.on('disconnect', () => setStatus('offline'))
      client.on('reconnect', () => setStatus('connecting'))
    })

    return () => {
      if (clientRef.current) {
        clientRef.current.end()
      }
    }
  }, [])

  const round = (v, d = 2) =>
    v !== null && v !== undefined ? Number(Number(v).toFixed(d)) : null


const energiKwh = data?.energi ?? 0
const biayaStr  = data?.biaya != null
  ? Math.round(data.biaya).toLocaleString('id-ID')
  : null

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            ⚡ Monitoring Listrik Kamar Kos
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Real-time via MQTT · {MQTT_TOPIC}
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-1">
          <StatusBadge status={status} />
          <div className="flex gap-3 text-xs text-gray-600">
            {lastUpdate && (
              <span>Update: {lastUpdate.toLocaleTimeString('id-ID')}</span>
            )}
            <span>{msgCount} pesan diterima</span>
          </div>
        </div>
      </div>

      {/* Gauge Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <GaugeCard
          label="Tegangan" value={round(data?.tegangan, 1)}
          unit="V" min={180} max={260} color="blue"
        />
        <GaugeCard
          label="Arus" value={round(data?.arus, 3)}
          unit="A" min={0} max={4} color="green"
        />
        <GaugeCard
          label="Daya" value={round(data?.daya, 1)}
          unit="W" min={0} max={900} color="yellow"
        />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <StatCard
          label="Total Energi"
          value={round(data?.energi, 4)}
          unit="kWh"
          colorClass="text-blue-400"
          icon="🔋"
        />
        <StatCard
          label="Estimasi Tagihan"
          value={biayaStr ? `Rp ${biayaStr}` : '—'}
          unit=""
          colorClass="text-yellow-400"
          icon="💰"
        />
      </div>

      {/* Grafik Daya */}
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-gray-300 font-semibold text-sm">
            📈 Grafik Daya Real-time
          </h2>
          <span className="text-gray-600 text-xs">30 data terakhir</span>
        </div>
        {history.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-600 text-sm">
            Menunggu data dari ESP32...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" tick={{ fill: '#4b5563', fontSize: 9 }}
                interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} unit=" W" />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="daya" stroke="#facc15"
                strokeWidth={2} dot={false} name="Daya" unit="W" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="text-center text-gray-700 text-xs mt-6">
        Capstone Design Project · Teknik Elektro · {new Date().getFullYear()}
      </p>
    </div>
  )
}