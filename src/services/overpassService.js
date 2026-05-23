const OVERPASS = 'https://overpass-api.de/api/interpreter'

const TYPE_QUERIES = {
  museum:     ['node["tourism"="museum"]', 'node["tourism"="gallery"]', 'node["amenity"="arts_centre"]', 'way["tourism"="museum"]'],
  restaurant: ['node["amenity"="restaurant"]', 'node["amenity"="cafe"]', 'node["amenity"="bar"]'],
  nature:     ['node["leisure"="park"]', 'way["leisure"="park"]', 'node["leisure"="garden"]', 'node["tourism"="viewpoint"]'],
  show:       ['node["amenity"="theatre"]', 'node["amenity"="cinema"]', 'node["amenity"="music_venue"]', 'node["amenity"="concert_hall"]'],
  amusement:  ['node["tourism"="theme_park"]', 'way["tourism"="theme_park"]', 'node["leisure"="amusement_arcade"]', 'node["leisure"="miniature_golf"]', 'node["leisure"="bowling_alley"]'],
}

function detectCategory(tags) {
  if (['museum', 'gallery'].includes(tags.tourism) || tags.amenity === 'arts_centre') return 'museum'
  if (['restaurant', 'cafe', 'bar', 'fast_food', 'pub'].includes(tags.amenity)) return 'restaurant'
  if (['park', 'garden'].includes(tags.leisure) || tags.tourism === 'viewpoint') return 'nature'
  if (['theatre', 'cinema', 'music_venue', 'concert_hall'].includes(tags.amenity)) return 'show'
  if (tags.tourism === 'theme_park' || ['amusement_arcade', 'miniature_golf', 'bowling_alley'].includes(tags.leisure)) return 'amusement'
  return null
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`
}

function buildAddress(tags) {
  const parts = []
  if (tags['addr:housenumber'] && tags['addr:street']) {
    parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`)
  } else if (tags['addr:street']) {
    parts.push(tags['addr:street'])
  }
  if (tags['addr:city']) parts.push(tags['addr:city'])
  return parts.join(', ') || null
}

export async function fetchActivities(lat, lng, radiusKm, categories) {
  const r = Math.round(radiusKm * 1000)

  const parts = categories
    .flatMap((cat) => (TYPE_QUERIES[cat] || []).map((t) => `${t}(around:${r},${lat},${lng});`))

  const query = `[out:json][timeout:25];\n(\n${parts.join('\n')}\n);\nout center tags;`

  const res = await fetch(OVERPASS, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  if (!res.ok) throw new Error('Overpass API indisponible')

  const { elements } = await res.json()

  return elements
    .filter((el) => el.tags?.name)
    .map((el) => {
      const elLat = el.lat ?? el.center?.lat
      const elLng = el.lon ?? el.center?.lon
      return {
        id: `osm-${el.type}-${el.id}`,
        name: el.tags.name,
        category: detectCategory(el.tags) ?? categories[0],
        address: buildAddress(el.tags),
        description: el.tags.description || el.tags['description:fr'] || el.tags.note || null,
        distance: haversine(lat, lng, elLat, elLng),
        openingHours: el.tags.opening_hours || null,
        website: el.tags.website || el.tags['contact:website'] || null,
        phone: el.tags.phone || el.tags['contact:phone'] || null,
        lat: elLat,
        lng: elLng,
      }
    })
    .slice(0, 60)
}
