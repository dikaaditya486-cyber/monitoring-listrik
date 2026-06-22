'use client'

import { useEffect, useState, useRef } from 'react'
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

// ============================================================
// KONFIGURASI — SESUAIKAN DENGAN HIVEMQ KAMU
// ============================================================
const MQTT_HOST     = '511fe9a7fee54db288deaa763f691cc5.s1.eu.hivemq.cloud' 
const MQTT_PORT     = 8884
const MQTT_USERNAME = 'esp32user'   
const MQTT_PASSWORD = 'Password123' 
const MQTT_TOPIC    = 'Smart Home' // Pastikan sesuai
// ============================================================

// ── Gauge Setengah Lingkaran ─────────────────────────────────
function GaugeCard({ label, value, unit, min, max, color, isDark }) {
  const safeValue = value !== null && value !== undefined ? Number(value) : null
  
  const pct = safeValue !== null
    ? Math.min(Math.max(((safeValue - min) / (max - min)) * 100, 0), 100)
    : 0

  const r = 65, cx = 90, cy = 88
  const circumference = Math.PI * r
  const dashoffset = circumference - (pct / 100) * circumference

  const colorMap = {
    blue: '#38bdf8', green: '#4ade80', yellow: '#facc15', red: '#f87171'
  }
  const strokeColor = colorMap[color] || '#38bdf8'
  const glowId = `glow-${label}`

  return (
    <div className={`rounded-2xl p-4 border flex flex-col items-center transition-colors duration-300 ${
      isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
    }`}>
      <span className={`text-xs font-semibold tracking-widest uppercase mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        {label}
      </span>
      <svg width="180" height="115" viewBox="0 0 180 115">
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={isDark ? "3" : "1.5"} result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        
        {/* Track Latar Belakang */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" 
          stroke={isDark ? "#1f2937" : "#e5e7eb"} 
          strokeWidth="10" strokeLinecap="round"
        />
        
        {/* Arc Berwarna */}
        {safeValue !== null && pct > 0 && (
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none" 
            stroke={strokeColor} 
            strokeWidth="10"
            strokeLinecap="round" 
            filter={`url(#${glowId})`}
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            className="transition-all duration-500 ease-in-out"
          />
        )}
        
        <text x={cx} y={cy - 6} textAnchor="middle" fill={isDark ? "white" : "#111827"}
          fontSize="26" fontWeight="700" fontFamily="monospace">
          {safeValue !== null ? safeValue : '—'}
        </text>
        
        <text x={cx} y={cy + 16} textAnchor="middle"
          fill={isDark ? "#6b7280" : "#9ca3af"} fontSize="13" fontWeight="500">
          {unit}
        </text>
        
        <text x={cx - r + 6} y={cy + 22} textAnchor="middle"
          fill={isDark ? "#374151" : "#d1d5db"} fontSize="9">{min}</text>
        <text x={cx + r - 6} y={cy + 22} textAnchor="middle"
          fill={isDark ? "#374151" : "#d1d5db"} fontSize="9">{max}</text>
      </svg>
    </div>
  )
}

// ── Kartu Stat ───────────────────────────────────────────────
function StatCard({ label, value, unit, colorClass, icon, sub, isDark }) {
  return (
    <div className={`rounded-2xl p-5 border flex flex-col gap-1 transition-colors duration-300 ${
      isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-semibold tracking-widest uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {label}
        </span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className={`text-3xl font-bold font-mono ${colorClass}`}>
          {value ?? '—'}
        </span>
        {unit && <span className={`text-sm mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{unit}</span>}
      </div>
      {sub && <span className="text-gray-600 text-xs mt-1">{sub}</span>}
    </div>
  )
}

// ── Badge Status ─────────────────────────────────────────────
function StatusBadge({ status, isDark }) {
  const config = {
    connecting: { color: 'bg-yellow-500', text: 'Menghubungkan...', pulse: true },
    online:     { color: 'bg-green-400',  text: 'Online',           pulse: true },
    offline:    { color: 'bg-red-500',    text: 'Offline',          pulse: false },
  }
  const c = config[status] || config.connecting
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200 shadow-sm'}`}>
      <span className={`w-2 h-2 rounded-full ${c.color} ${c.pulse ? 'animate-pulse' : ''}`} />
      <span className={`text-xs font-medium ${
        status === 'online' ? (isDark ? 'text-green-400' : 'text-green-600') :
        status === 'offline' ? (isDark ? 'text-red-400' : 'text-red-600') : 
        (isDark ? 'text-yellow-400' : 'text-yellow-600')
      }`}>{c.text}</span>
    </div>
  )
}

// ── Custom Tooltip Chart ─────────────────────────────────────
function CustomTooltip({ active, payload, label, isDark }) {
  if (!active || !payload?.length) return null
  return (
    <div className={`border rounded-xl px-3 py-2 text-xs shadow-lg ${
      isDark ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white border-gray-200 text-gray-600'
    }`}>
      <p className="mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: isDark ? p.color : '#ca8a04' }} className="font-mono font-bold">
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
  
  // State untuk Tema (Default: Gelap)
  const [isDark, setIsDark]       = useState(true) 
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
      if (clientRef.current) clientRef.current.end()
    }
  }, [])

  const round = (v, d = 2) =>
    v !== null && v !== undefined ? Number(Number(v).toFixed(d)) : null

  const biayaStr  = data?.biaya != null
    ? Math.round(data.biaya).toLocaleString('id-ID')
    : null

  return (
    <div className={`min-h-screen p-4 md:p-8 transition-colors duration-500 ${
      isDark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'
    }`}>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <img src="/Logo.png" alt="Logo Kumitika" className="h-10 w-auto" />
            Monitoring Listrik Kamar Kos
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            Real-time via MQTT · {MQTT_TOPIC}
          </p>
        </div>
        
        <div className="flex flex-col items-start md:items-end gap-3">
          <div className="flex items-center gap-3">
            <StatusBadge status={status} isDark={isDark} />
            
            {/* Tombol Toggle Tema */}
            <button 
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-full transition-colors border ${
                isDark ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-yellow-400' 
                       : 'bg-white hover:bg-gray-100 border-gray-300 text-blue-600 shadow-sm'
              }`}
              title="Ganti Tema"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>

          <div className={`flex gap-3 text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
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
          unit="V" min={180} max={260} color="blue" isDark={isDark}
        />
        <GaugeCard
          label="Arus" value={round(data?.arus, 3)}
          unit="A" min={0} max={4} color="green" isDark={isDark}
        />
        <GaugeCard
          label="Daya" value={round(data?.daya, 1)}
          unit="W" min={0} max={900} color="yellow" isDark={isDark}
        />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <StatCard
          label="Total Energi"
          value={round(data?.energi, 4)}
          unit="kWh"
          colorClass={isDark ? "text-blue-400" : "text-blue-600"}
          icon="🔋"
          isDark={isDark}
        />
        <StatCard
          label="Estimasi Tagihan"
          value={biayaStr ? `Rp ${biayaStr}` : '—'}
          unit=""
          colorClass={isDark ? "text-yellow-400" : "text-yellow-600"}
          icon="💰"
          isDark={isDark}
        />
      </div>

      {/* Grafik Daya */}
      <div className={`rounded-2xl p-5 border mb-4 transition-colors duration-300 ${
        isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`font-semibold text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            📈 Grafik Daya Real-time
          </h2>
          <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>30 data terakhir</span>
        </div>
        {history.length === 0 ? (
          <div className={`flex items-center justify-center h-40 text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            Menunggu data dari ESP32...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f2937" : "#e5e7eb"} />
              <XAxis dataKey="time" tick={{ fill: isDark ? '#4b5563' : '#9ca3af', fontSize: 9 }}
                interval="preserveStartEnd" />
              <YAxis tick={{ fill: isDark ? '#4b5563' : '#9ca3af', fontSize: 10 }} unit=" W" />
              <Tooltip content={<CustomTooltip isDark={isDark} />} />
              <Line type="monotone" dataKey="daya" stroke={isDark ? "#facc15" : "#ca8a04"}
                strokeWidth={2} dot={false} name="Daya" unit="W" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className={`text-center text-xs mt-6 ${isDark ? 'text-gray-700' : 'text-gray-400'}`}>
        Capstone Design Project · Teknik Elektro · {new Date().getFullYear()}
      </p>
    </div>
  )
}