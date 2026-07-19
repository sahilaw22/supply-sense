'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { nodes, routes, nodeMap, type GeoNode, type GeoRoute } from '@/lib/supply-chain-geo'
import { ArrowRight, Eye, EyeOff, Plus, Minus } from 'lucide-react'

const CRITICAL = '#FF3B30'
const WARNING = '#F59E0B'
const HEALTHY = '#22C55E'
const MUTED = '#4a4a52'

function createMarkerIcon(node: GeoNode) {
  const color = node.status === 'critical' ? CRITICAL : node.status === 'warning' ? WARNING : HEALTHY
  const size = node.type === 'warehouse' ? 14 : node.type === 'port' ? 12 : 10
  return L.divIcon({
    className: 'flow-node',
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:2px solid ${color};border-radius:50%;box-shadow:0 0 8px ${color}40"></div>${
      node.type === 'warehouse' ? `<span style="position:absolute;top:16px;left:50%;transform:translateX(-50%);white-space:nowrap;font:600 9px Inter,sans-serif;color:#d4d4d8;text-shadow:0 1px 4px #000">${node.name.split(' ').slice(0, 2).join(' ')}</span>` : ''
    }`,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
  })
}

function animateDash(polyline: L.Polyline, duration = 800) {
  let offset = 0
  const step = () => {
    offset = (offset + 1) % 16
    polyline.setStyle({ dashOffset: String(-offset) })
  }
  const id = setInterval(step, duration / 16)
  return () => clearInterval(id)
}

interface FlowMapProps {
  disrupted: boolean
  onReroute?: () => void
}

export function FlowMap({ disrupted, onReroute }: FlowMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<L.LayerGroup | null>(null)
  const animCleanupsRef = useRef<Array<() => void>>([])
  const [showAll, setShowAll] = useState(false)
  const [hoverNode, setHoverNode] = useState<GeoNode | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })

  const initMap = useCallback(() => {
    if (!mapContainerRef.current || mapRef.current) return
    const map = L.map(mapContainerRef.current, {
      center: [21.5, 78.5],
      zoom: 5,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map)
    mapRef.current = map
  }, [])

  const renderRoutes = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    if (layersRef.current) map.removeLayer(layersRef.current)
    animCleanupsRef.current.forEach(fn => fn())
    animCleanupsRef.current = []

    const layerGroup = L.layerGroup()

    routes.forEach(route => {
      const fromNode = nodeMap[route.from]
      const toNode = nodeMap[route.to]
      if (!fromNode || !toNode) return

      const isVisible = route.status !== 'healthy' || showAll
      if (!isVisible) return

      const color = route.status === 'critical' ? CRITICAL : route.status === 'warning' ? WARNING : MUTED
      const w = route.status === 'critical' ? 3.5 : route.status === 'warning' ? 2.5 : 1.5
      const opacity = route.status === 'critical' ? 1 : 0.55

      const polyline = L.polyline(
        [[fromNode.lat, fromNode.lng], [toNode.lat, toNode.lng]],
        {
          color,
          weight: w,
          opacity,
          dashArray: route.status === 'healthy' ? '6 6' : '8 6',
          lineCap: 'round',
        }
      )

      const cleanup = animateDash(polyline, route.status === 'critical' ? 600 : 1000)
      animCleanupsRef.current.push(cleanup)

      const midLat = (fromNode.lat + toNode.lat) / 2
      const midLng = (fromNode.lng + toNode.lng) / 2
      const angle = Math.atan2(toNode.lat - fromNode.lat, toNode.lng - fromNode.lng) * (180 / Math.PI)

      L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: 'flow-arrow',
          html: `<div style="transform:rotate(${angle}deg);color:${color};font-size:${route.status === 'critical' ? '14px' : '10px'};opacity:${opacity}">▶</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
      }).addTo(layerGroup)

      const popupContent = document.createElement('div')
      popupContent.className = 'flow-popup'
      popupContent.innerHTML = `
        <div class="flow-popup-header">
          <span class="flow-popup-label" style="color:${color}">${route.label}</span>
          <span class="flow-popup-status" style="background:${color === CRITICAL ? 'rgba(255,59,48,.15)' : color === WARNING ? 'rgba(245,158,11,.15)' : 'rgba(34,197,94,.15)'};color:${color}">${route.status.toUpperCase()}</span>
        </div>
        ${route.issue ? `<div class="flow-popup-row"><strong>Issue</strong><span>${route.issue}</span></div>` : ''}
        ${route.impact ? `<div class="flow-popup-row"><strong>Impact</strong><span>${route.impact}</span></div>` : ''}
        ${route.etaDays ? `<div class="flow-popup-row"><strong>ETA</strong><span>${route.etaDays} day${route.etaDays !== 1 ? 's' : ''}</span></div>` : ''}
        ${route.status !== 'healthy' ? `<button class="flow-popup-btn" data-route-id="${route.id}">Reroute Shipment <span>→</span></button>` : ''}
      `
      popupContent.querySelector('.flow-popup-btn')?.addEventListener('click', () => {
        onReroute?.()
      })
      polyline.bindPopup(popupContent, { className: 'flow-popup-wrapper', closeButton: false, offset: L.point(0, -10) })
      polyline.on('mouseover', () => polyline.setStyle({ weight: w + 1, opacity: 1 }))
      polyline.on('mouseout', () => polyline.setStyle({ weight: w, opacity }))
      polyline.addTo(layerGroup)
    })

    nodes.forEach(node => {
      const marker = L.marker([node.lat, node.lng], { icon: createMarkerIcon(node) })

      marker.on('mouseover', (e) => {
        setHoverNode(node)
        setHoverPos({ x: e.originalEvent.clientX, y: e.originalEvent.clientY })
      })
      marker.on('mouseout', () => setHoverNode(null))

      const nodePopup = document.createElement('div')
      nodePopup.className = 'flow-popup'
      const nodeColor = node.status === 'critical' ? CRITICAL : node.status === 'warning' ? WARNING : HEALTHY
      nodePopup.innerHTML = `
        <div class="flow-popup-header">
          <span class="flow-popup-label">${node.name}</span>
          <span class="flow-popup-status" style="background:${node.status === 'critical' ? 'rgba(255,59,48,.15)' : node.status === 'warning' ? 'rgba(245,158,11,.15)' : 'rgba(34,197,94,.15)'};color:${nodeColor}">${node.status.toUpperCase()}</span>
        </div>
        <div class="flow-popup-row"><strong>Type</strong><span>${node.type.charAt(0).toUpperCase() + node.type.slice(1)}</span></div>
        <div class="flow-popup-row"><strong>Details</strong><span>${node.description}</span></div>
      `
      marker.bindPopup(nodePopup, { className: 'flow-popup-wrapper', closeButton: false })
      marker.addTo(layerGroup)
    })

    layerGroup.addTo(map)
    layersRef.current = layerGroup
  }, [showAll, disrupted, onReroute])

  useEffect(() => {
    initMap()
    return () => {
      animCleanupsRef.current.forEach(fn => fn())
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [initMap])

  useEffect(() => { renderRoutes() }, [renderRoutes])

  const zoomIn = () => mapRef.current?.zoomIn()
  const zoomOut = () => mapRef.current?.zoomOut()
  const toggleShowAll = () => setShowAll(v => !v)

  return (
    <div className="flow-map-panel">
      <div className="flow-map-head">
        <div>
          <span className="eyebrow">Live network</span>
          <h2 style={{ fontFamily: 'var(--font-anta)', letterSpacing: '-.02em' }}>India supply chain network</h2>
        </div>
        <div className="flow-map-actions">
          <button className={`flow-toggle ${showAll ? 'active' : ''}`} onClick={toggleShowAll}>
            {showAll ? <EyeOff size={14} /> : <Eye size={14} />}
            {showAll ? 'Hide healthy' : 'View all routes'}
          </button>
          <div className="flow-legend">
            <span><i style={{ background: CRITICAL }} /> Critical</span>
            <span><i style={{ background: WARNING }} /> Watch</span>
            <span><i style={{ background: HEALTHY }} /> Normal</span>
          </div>
        </div>
      </div>
      <div className="flow-map-body">
        <div ref={mapContainerRef} className="flow-map-container" />
        <div className="flow-zoom">
          <button className="flow-zoom-btn" onClick={zoomIn} aria-label="Zoom in"><Plus size={16} /></button>
          <button className="flow-zoom-btn" onClick={zoomOut} aria-label="Zoom out"><Minus size={16} /></button>
        </div>
        {hoverNode && (
          <div className="flow-hover-panel" style={{ left: Math.min(hoverPos.x + 14, window.innerWidth - 260), top: Math.min(hoverPos.y - 10, window.innerHeight - 140) }}>
            <div className="flow-hover-name">{hoverNode.name}</div>
            <div className="flow-hover-detail">{hoverNode.type} · {hoverNode.description}</div>
            <span className="flow-hover-status" style={{
              background: hoverNode.status === 'critical' ? 'rgba(255,59,48,.15)' : hoverNode.status === 'warning' ? 'rgba(245,158,11,.15)' : 'rgba(34,197,94,.15)',
              color: hoverNode.status === 'critical' ? CRITICAL : hoverNode.status === 'warning' ? WARNING : HEALTHY,
            }}>{hoverNode.status.toUpperCase()}</span>
          </div>
        )}
      </div>
    </div>
  )
}
