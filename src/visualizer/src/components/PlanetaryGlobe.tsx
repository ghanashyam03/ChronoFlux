/**
 * @file PlanetaryGlobe.tsx
 * Three.js 3D Earth view with directional sunlight, subsolar vector, and observer location pin.
 */

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { TemporalStateHook } from '../state/useTemporalState.js';
import { getSubsolarPoint } from '../utils/subsolar-point.js';
import { formatCoordinate } from '../utils/timeline.js';

interface PlanetaryGlobeProps {
  readonly state: TemporalStateHook;
}

/**
 * Converts geodetic latitude and longitude (in degrees) to 3D Cartesian coordinates on a sphere of radius R.
 * In Three.js:
 * Y = up (North Pole)
 * X = (lat 0, lon 0 prime meridian)
 * Z = (lat 0, lon 90 E)
 */
function geoToCartesian(latDeg: number, lonDeg: number, radius: number): THREE.Vector3 {
  const phi = (90 - latDeg) * (Math.PI / 180);
  const theta = (lonDeg + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

/**
 * Procedurally generates a clean stylized vector-line Earth texture with continents and graticule.
 * Guaranteed 100% offline, zero network requests, zero broken assets.
 */
function createProceduralEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep space ocean
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1024, 512);

  // Stylized simplified continental outlines
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;

  // Draw simplified continents (Europe/Asia, Africa, Americas, Australia, Antarctica)
  function drawContinent(points: [number, number][]) {
    ctx.beginPath();
    points.forEach(([lon, lat], i) => {
      // Map lon [-180, 180] to [0, 1024], lat [-90, 90] to [512, 0]
      const x = ((lon + 180) / 360) * 1024;
      const y = ((90 - lat) / 180) * 512;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Africa
  drawContinent([
    [-18, 35], [25, 32], [51, 12], [42, -10], [28, -34], [18, -34], [12, -5], [-5, 5], [-17, 15]
  ]);
  // Eurasia
  drawContinent([
    [-9, 36], [2, 51], [25, 71], [105, 78], [170, 66], [140, 36], [105, 10], [75, 10], [60, 25], [36, 36]
  ]);
  // North America
  drawContinent([
    [-168, 66], [-130, 70], [-80, 72], [-55, 50], [-75, 35], [-80, 25], [-105, 20], [-124, 48], [-160, 58]
  ]);
  // South America
  drawContinent([
    [-80, 10], [-50, 0], [-35, -5], [-40, -22], [-65, -55], [-75, -45], [-80, -5]
  ]);
  // Australia
  drawContinent([
    [114, -22], [130, -12], [145, -15], [153, -28], [140, -38], [115, -34]
  ]);
  // Antarctica
  drawContinent([
    [-180, -75], [180, -75], [180, -90], [-180, -90]
  ]);

  // Graticule grid lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.lineWidth = 1;

  // Parallels: Equator (0°), Tropics (±23.44°), Polar circles (±66.56°)
  const parallels = [0, 23.44, -23.44, 66.56, -66.56];
  for (const lat of parallels) {
    const y = ((90 - lat) / 180) * 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Meridians (every 30°)
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * 1024;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export const PlanetaryGlobe: React.FC<PlanetaryGlobeProps> = ({ state }) => {
  const { activeInstant, selectedPlace } = state;

  const mountRef = useRef<HTMLDivElement | null>(null);

  // References to keep between renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const observerPinRef = useRef<THREE.Mesh | null>(null);
  const subsolarPinRef = useRef<THREE.Mesh | null>(null);
  const horizonRingRef = useRef<THREE.Line | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const subsolar = getSubsolarPoint(activeInstant, selectedPlace);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 340;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2, 4.5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const globeRadius = 1.6;

    // 2. Earth Sphere
    const earthGeometry = new THREE.SphereGeometry(globeRadius, 48, 48);
    const earthTexture = createProceduralEarthTexture();
    const earthMaterial = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.8,
      metalness: 0.1,
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earthMesh);

    // 3. Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0x1a2336, 0.8);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 2.8);
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // 4. Subsolar Point Marker (Gold sphere)
    const subsolarGeo = new THREE.SphereGeometry(0.045, 16, 16);
    const subsolarMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const subsolarMesh = new THREE.Mesh(subsolarGeo, subsolarMat);
    scene.add(subsolarMesh);
    subsolarPinRef.current = subsolarMesh;

    // 5. Observer Location Pin (Cyan sphere)
    const observerGeo = new THREE.SphereGeometry(0.045, 16, 16);
    const observerMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const observerMesh = new THREE.Mesh(observerGeo, observerMat);
    scene.add(observerMesh);
    observerPinRef.current = observerMesh;

    // 6. Horizon Plane Circle around observer
    const horizonGeo = new THREE.BufferGeometry();
    const horizonPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      horizonPoints.push(new THREE.Vector3(Math.cos(angle) * 0.25, 0, Math.sin(angle) * 0.25));
    }
    horizonGeo.setFromPoints(horizonPoints);
    const horizonMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });
    const horizonRing = new THREE.Line(horizonGeo, horizonMat);
    scene.add(horizonRing);
    horizonRingRef.current = horizonRing;

    // 7. Interactive Orbit Drag Controls
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let sphericalTheta = 0;
    let sphericalPhi = Math.PI / 3;
    const distance = 4.5;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      container.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      sphericalTheta -= deltaX * 0.008;
      sphericalPhi = Math.max(0.1, Math.min(Math.PI - 0.1, sphericalPhi - deltaY * 0.008));

      camera.position.x = distance * Math.sin(sphericalPhi) * Math.sin(sphericalTheta);
      camera.position.y = distance * Math.cos(sphericalPhi);
      camera.position.z = distance * Math.sin(sphericalPhi) * Math.cos(sphericalTheta);
      camera.lookAt(0, 0, 0);
    };

    const onPointerUp = (e: PointerEvent) => {
      isDragging = false;
      try {
        container.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);

    // Render loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);

      earthGeometry.dispose();
      earthTexture.dispose();
      earthMaterial.dispose();
      subsolarGeo.dispose();
      subsolarMat.dispose();
      observerGeo.dispose();
      observerMat.dispose();
      horizonGeo.dispose();
      horizonMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Sunlight & Marker Positions when activeInstant or selectedPlace changes
  useEffect(() => {
    const globeRadius = 1.6;

    // Subsolar Position
    const subPos = geoToCartesian(subsolar.latitudeDeg, subsolar.longitudeDeg, globeRadius);
    const sunVector = subPos.clone().normalize().multiplyScalar(10);

    if (sunLightRef.current) {
      sunLightRef.current.position.copy(sunVector);
    }

    if (subsolarPinRef.current) {
      subsolarPinRef.current.position.copy(subPos.clone().multiplyScalar(1.02));
    }

    // Observer Position
    const obsPos = geoToCartesian(selectedPlace.latitude, selectedPlace.longitude, globeRadius);
    if (observerPinRef.current) {
      observerPinRef.current.position.copy(obsPos.clone().multiplyScalar(1.02));
    }

    // Horizon Ring orientation
    if (horizonRingRef.current) {
      horizonRingRef.current.position.copy(obsPos.clone().multiplyScalar(1.01));
      const normal = obsPos.clone().normalize();
      horizonRingRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    }
  }, [subsolar, selectedPlace]);

  return (
    <div className="diagnostic-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="panel-title">3D Planetary Solar Geometry</span>
        </div>
        <span className="panel-subtitle">Earth-Fixed WGS84 Reference Sphere</span>
      </div>

      <div className="panel-body" style={{ padding: 0 }}>
        <div className="globe-container" ref={mountRef}>
          {/* Overlay Diagnostics */}
          <div className="globe-overlay-info">
            <div>
              <span className="subsolar-tag">Subsolar Point:</span>{' '}
              {formatCoordinate(subsolar.latitudeDeg, subsolar.longitudeDeg)}
            </div>
            <div>
              <span className="observer-tag">Observer:</span>{' '}
              {formatCoordinate(selectedPlace.latitude, selectedPlace.longitude)}
            </div>
            <div className="text-muted" style={{ marginTop: '4px' }}>
              Drag to rotate view | Scroll to zoom
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
