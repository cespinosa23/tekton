import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Search, X, Navigation } from 'lucide-react'

const DEFAULT_LOCATION = { lat: 14.5176, lon: 121.0509, name: 'Taguig', country: 'PH' }

const WMO = {
  0:  { label: 'Clear',         icon: '☀️' },
  1:  { label: 'Mainly Clear',  icon: '🌤️' },
  2:  { label: 'Partly Cloudy', icon: '⛅' },
  3:  { label: 'Overcast',      icon: '☁️' },
  45: { label: 'Fog',           icon: '🌫️' },
  48: { label: 'Fog',           icon: '🌫️' },
  51: { label: 'Drizzle',       icon: '🌦️' },
  53: { label: 'Drizzle',       icon: '🌦️' },
  55: { label: 'Drizzle',       icon: '🌦️' },
  61: { label: 'Rain',          icon: '🌧️' },
  63: { label: 'Rain',          icon: '🌧️' },
  65: { label: 'Heavy Rain',    icon: '🌧️' },
  80: { label: 'Showers',       icon: '🌦️' },
  81: { label: 'Showers',       icon: '🌦️' },
  82: { label: 'Heavy Showers', icon: '🌧️' },
  95: { label: 'Thunderstorm',  icon: '⛈️' },
  96: { label: 'Thunderstorm',  icon: '⛈️' },
  99: { label: 'Thunderstorm',  icon: '⛈️' },
}
const wmo = (code) => WMO[code] ?? { label: 'Unknown', icon: '🌡️' }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Format "14:00" → "2 PM"
const fmtHour = (timeStr) => {
  const h = parseInt(timeStr?.slice(0, 2) ?? '0', 10)
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}`
}

// Find the hourly index for the current moment using the location's UTC offset
const getStartIdx = (times, utcOffsetSeconds) => {
  const now = Date.now()
  let best = 0
  for (let i = 0; i < times.length; i++) {
    const tUtc = new Date(times[i] + 'Z').getTime() - utcOffsetSeconds * 1000
    if (tUtc <= now) best = i
    else break
  }
  return best
}

const reverseGeocode = async (lat, lon) => {
  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
  )
  const d = await res.json()
  return {
    name: d.city || d.locality || d.principalSubdivision || 'My Location',
    country: d.countryCode || '',
  }
}

export default function WeatherCard() {
  const [location, setLocation] = useState(() => {
    try { return JSON.parse(localStorage.getItem('weather_location')) || null }
    catch { return null }
  })
  const [locating, setLocating] = useState(false)
  const [tab, setTab] = useState('24h')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const wrapRef = useRef(null)

  // Auto-detect on first visit
  useEffect(() => { if (!location) detectMyLocation() }, [])

  const detectMyLocation = () => {
    if (!navigator.geolocation) { setLocation(DEFAULT_LOCATION); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const geo = await reverseGeocode(coords.latitude, coords.longitude)
          const loc = { lat: coords.latitude, lon: coords.longitude, ...geo }
          setLocation(loc)
          localStorage.setItem('weather_location', JSON.stringify(loc))
        } catch { setLocation(DEFAULT_LOCATION) }
        finally { setLocating(false) }
      },
      () => { setLocation(DEFAULT_LOCATION); setLocating(false) },
      { timeout: 8000 }
    )
  }

  // Debounced geocoding
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`)
        setResults((await res.json()).results || [])
      } catch { setResults([]) }
    }, 400)
    return () => clearTimeout(id)
  }, [query])

  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowSearch(false); setQuery(''); setResults([])
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const selectLocation = (r) => {
    const loc = { lat: r.latitude, lon: r.longitude, name: r.name, country: r.country_code || r.country || '' }
    setLocation(loc)
    localStorage.setItem('weather_location', JSON.stringify(loc))
    setShowSearch(false); setQuery(''); setResults([])
  }

  const activeLoc = location || DEFAULT_LOCATION

  const { data, isLoading, isError } = useQuery({
    queryKey: ['weather', activeLoc.lat, activeLoc.lon],
    queryFn: async () => {
      const url = new URL('https://api.open-meteo.com/v1/forecast')
      url.searchParams.set('latitude', activeLoc.lat)
      url.searchParams.set('longitude', activeLoc.lon)
      url.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m')
      url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,weather_code')
      url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max')
      url.searchParams.set('timezone', 'auto')
      url.searchParams.set('forecast_days', '7')
      url.searchParams.set('wind_speed_unit', 'kmh')
      const res = await fetch(url)
      if (!res.ok) throw new Error()
      return res.json()
    },
    enabled: !!activeLoc,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  })

  if (isError) return null

  const cur = data?.current
  const hourly = data?.hourly
  const daily = data?.daily
  const utcOffset = data?.utc_offset_seconds ?? 28800

  const startIdx = hourly ? getStartIdx(hourly.time, utcOffset) : 0

  const next24 = hourly
    ? Array.from({ length: 24 }, (_, i) => {
        const idx = startIdx + i
        const timeStr = (hourly.time[idx] ?? '').slice(11, 16)
        const { label: condition, icon } = wmo(hourly.weather_code?.[idx] ?? 0)
        return {
          time:      i === 0 ? 'Now' : fmtHour(timeStr),
          condition,
          icon,
          temp:      Math.round(hourly.temperature_2m[idx] ?? 0),
          rain:      hourly.precipitation_probability[idx] ?? 0,
        }
      })
    : []

  const next7 = daily
    ? daily.time.map((dateStr, i) => {
        const localMs = new Date(dateStr + 'T00:00:00Z').getTime() + utcOffset * 1000
        const dayIdx = new Date(localMs).getUTCDay()
        return {
          day:  i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAYS[dayIdx],
          ...wmo(daily.weather_code[i]),
          max:  Math.round(daily.temperature_2m_max[i]),
          min:  Math.round(daily.temperature_2m_min[i]),
          rain: daily.precipitation_probability_max[i] ?? 0,
        }
      })
    : []

  return (
    <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200">

      {/* ── Dark gradient header ── */}
      <div
        className="relative px-6 pt-5 pb-6"
        style={{ background: 'linear-gradient(135deg, #0f2942 0%, #1a4a7a 60%, #1e6fa8 100%)' }}
      >
        {/* Location row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <MapPin size={13} className="text-blue-300 flex-shrink-0 mt-0.5" />
            <span className="text-white font-semibold text-sm">
              {locating ? 'Detecting location…' : `${activeLoc.name}${activeLoc.country ? `, ${activeLoc.country}` : ''}`}
            </span>
          </div>

          {/* Search controls */}
          <div className="relative" ref={wrapRef}>
            <div className="flex items-center gap-1">
              <button
                onClick={detectMyLocation}
                disabled={locating}
                title="Use my current location"
                className="p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40">
                <Navigation size={13} />
              </button>
              {showSearch ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search city…"
                    className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-sm text-white placeholder-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300 w-40"
                  />
                  <button onClick={() => { setShowSearch(false); setQuery(''); setResults([]) }}
                    className="p-1 text-blue-300 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowSearch(true)}
                  className="p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors">
                  <Search size={13} />
                </button>
              )}
            </div>

            {/* Geocoding dropdown */}
            {results.length > 0 && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl z-50 overflow-hidden border border-gray-100">
                {results.map(r => (
                  <button key={`${r.latitude}-${r.longitude}`} onClick={() => selectLocation(r)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                    <p className="text-sm font-medium text-gray-800">{r.name}</p>
                    <p className="text-xs text-gray-400">{[r.admin1, r.country].filter(Boolean).join(', ')}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Current conditions */}
        {(isLoading || locating) ? (
          <div className="animate-pulse space-y-3">
            <div className="h-14 w-32 bg-white/10 rounded-lg" />
            <div className="h-4 w-24 bg-white/10 rounded" />
            <div className="flex gap-4 mt-4">
              {[1,2,3,4].map(i => <div key={i} className="h-10 w-16 bg-white/10 rounded" />)}
            </div>
          </div>
        ) : cur ? (
          <div>
            <div className="flex items-end gap-4 mb-1">
              <span className="text-6xl leading-none">{wmo(cur.weather_code).icon}</span>
              <div>
                <p className="text-5xl font-bold text-white leading-none">{Math.round(cur.temperature_2m)}°C</p>
                <p className="text-blue-200 text-sm mt-1">{wmo(cur.weather_code).label}</p>
              </div>
            </div>
            <p className="text-blue-300 text-xs mt-1 mb-4">Feels like {Math.round(cur.apparent_temperature)}°C</p>

            {/* Detail chips */}
            <div className="flex gap-5 flex-wrap">
              {[
                { label: 'Precipitation', value: `${cur.precipitation_probability}%` },
                { label: 'Humidity',      value: `${cur.relative_humidity_2m}%` },
                { label: 'Wind',          value: `${Math.round(cur.wind_speed_10m)} km/h` },
              ].map(({ label, value }) => (
                <div key={label} className="border-l border-white/20 pl-4 first:border-0 first:pl-0">
                  <p className="text-[10px] text-blue-300 uppercase tracking-wider">{label}</p>
                  <p className="text-white font-semibold text-sm mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Forecast body ── */}
      <div className="bg-white">
        {/* Tab bar */}
        <div className="flex border-b border-gray-100">
          {[['24h', '24 Hours'], ['7d', '7 Days']].map(([val, label]) => (
            <button key={val} onClick={() => setTab(val)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === val
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── 24-hour horizontal scroll ── */}
        {tab === '24h' && !isLoading && (
          <div className="overflow-x-auto px-4 py-4">
            <div className="flex gap-2 min-w-max">
              {next24.map((h, i) => (
                <div key={i} className={`flex flex-col items-center gap-2 rounded-xl px-3 py-3 w-[96px] transition-colors ${
                  i === 0 ? 'bg-blue-600 shadow-md' : 'bg-gray-50 hover:bg-gray-100'
                }`}>
                  {/* Time label */}
                  <p className={`text-xs font-semibold tracking-wide ${i === 0 ? 'text-blue-100' : 'text-gray-500'}`}>
                    {h.time}
                  </p>
                  {/* Condition icon */}
                  <span className="text-2xl leading-none">{h.icon}</span>
                  {/* Temperature */}
                  <p className={`text-base font-bold ${i === 0 ? 'text-white' : 'text-gray-800'}`}>
                    {h.temp}°C
                  </p>
                  {/* Rain chance */}
                  <p className={`text-xs font-medium ${i === 0 ? 'text-blue-200' : 'text-blue-500'}`}>
                    💧 {h.rain}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 7-day forecast ── */}
        {tab === '7d' && !isLoading && (
          <div className="grid grid-cols-7 gap-2 px-4 py-4">
            {next7.map((d, i) => (
              <div key={i} className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center ${
                i === 0 ? 'bg-blue-600 shadow-md' : 'bg-gray-50 hover:bg-gray-100 transition-colors'
              }`}>
                <p className={`text-xs font-semibold ${i === 0 ? 'text-blue-100' : 'text-gray-500'}`}>{d.day}</p>
                <span className="text-2xl leading-none">{d.icon}</span>
                <p className={`text-sm font-bold ${i === 0 ? 'text-white' : 'text-gray-800'}`}>{d.max}°</p>
                <p className={`text-xs ${i === 0 ? 'text-blue-200' : 'text-gray-400'}`}>{d.min}°</p>
                <p className={`text-xs font-medium ${i === 0 ? 'text-blue-200' : 'text-blue-500'}`}>💧 {d.rain}%</p>
              </div>
            ))}
          </div>
        )}

        {/* Attribution */}
        <div className="px-5 py-2 border-t border-gray-50">
          <p className="text-[10px] text-gray-300">Powered by Open-Meteo</p>
        </div>
      </div>
    </div>
  )
}
