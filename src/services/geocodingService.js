const NOMINATIM = 'https://nominatim.openstreetmap.org'

export async function geocodeCity(query) {
  const q = /france/i.test(query) ? query : `${query}, France`
  const params = new URLSearchParams({ q, format: 'json', limit: '1', 'accept-language': 'fr' })

  const res = await fetch(`${NOMINATIM}/search?${params}`, {
    headers: { 'User-Agent': 'ExplorerCulturel/1.0 (educational)' },
  })
  if (!res.ok) throw new Error('Erreur réseau lors du géocodage')

  const results = await res.json()
  if (!results.length) throw new Error(`Ville « ${query} » introuvable`)

  const { lat, lon, display_name } = results[0]
  return {
    lat: parseFloat(lat),
    lng: parseFloat(lon),
    displayName: display_name.split(',')[0].trim(),
  }
}

export async function reverseGeocode(lat, lng) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'json',
    'accept-language': 'fr',
  })

  const res = await fetch(`${NOMINATIM}/reverse?${params}`, {
    headers: { 'User-Agent': 'ExplorerCulturel/1.0 (educational)' },
  })
  if (!res.ok) throw new Error('Géocodage inverse impossible')

  const data = await res.json()
  const a = data.address || {}
  return a.city || a.town || a.village || a.municipality || a.county || 'Ma position'
}
