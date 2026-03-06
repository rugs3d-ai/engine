// Rugs3D - 8th Wall WebAR Test App
// Self-hosted 8th Wall engine for World Effects (SLAM tracking)
// Branding hidden via CSS

/* globals XR8 XRExtras THREE TWEEN */

const _dbgEl = document.createElement('div')
_dbgEl.id = 'debug-overlay'
_dbgEl.setAttribute('style', 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:rgba(0,0,0,0.85);color:#0f0;font:11px/1.4 monospace;padding:8px;max-height:40vh;overflow-y:auto;pointer-events:auto;display:none;white-space:pre-wrap;word-break:break-all;')
document.addEventListener('DOMContentLoaded', () => document.body.appendChild(_dbgEl))
const dbg = (msg) => { _dbgEl.style.display = 'block'; _dbgEl.textContent += new Date().toISOString().slice(11, 23) + ' ' + msg + '\n'; _dbgEl.scrollTop = _dbgEl.scrollHeight; console.log('[DBG]', msg) }
window.addEventListener('error', (e) => dbg('GLOBAL ERROR: ' + e.message + ' @ ' + e.filename + ':' + e.lineno))
window.addEventListener('unhandledrejection', (e) => dbg('UNHANDLED REJECT: ' + (e.reason && e.reason.message || e.reason)))

// GLB model URL (Supabase)
const RUG_MODEL_URL = 'https://dfcksvowcprcrpkpfptk.supabase.co/storage/v1/object/public/3d-models/models/2A0pQDoKVq/carpet_model_20260210_094217.glb'
let pipelineStarted = false

const getDevice = () => {
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'desktop'
}

const isInAppBrowser = () => {
  const ua = navigator.userAgent || ''
  return /FBAN|FBAV|Instagram|LinkedInApp|Twitter|Line\/|Snapchat|TikTok|BytedanceWebview|Musical_ly|UCBrowser|MicroMessenger|WeChat|QQ\/|Weibo|Pinterest/i.test(ua)
}

const resolveARRoute = (arMode) => {
  const device = getDevice()
  if (device === 'desktop') return 'qrcode'
  if (device === 'android') {
    if (isInAppBrowser()) return 'sceneviewer-direct'
    return 'modelviewer-webxr-android'
  }
  if (arMode === 'webxr') return 'webxr'
  if (arMode === 'native') return 'quicklook'
  if (isInAppBrowser()) return 'webxr'
  return 'webxr'
}

const launchSceneViewerDirect = (glbUrl, placement) => {
  const fileParam = encodeURIComponent(glbUrl)
  const fallback = encodeURIComponent(window.location.href)
  let queryParts = [
    'file=' + fileParam,
    'mode=ar_preferred',
    'disable_occlusion=false'
  ]
  if (placement === 'wall') queryParts.push('enable_vertical_placement=true')
  const query = queryParts.join('&')
  const intentUrl = `intent://arvr.google.com/scene-viewer/1.0?${query}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${fallback};end;`
  dbg('Scene Viewer intent: ' + intentUrl)
  window.location.href = intentUrl
}

const triggerNativeAR = () => {
  const mv = document.getElementById('model-viewer')
  if (mv && mv.activateAR) {
    mv.activateAR()
  }
}

const showQROverlay = () => {
  const overlay = document.getElementById('qr-overlay')
  if (overlay) overlay.style.display = 'flex'
  const pageUrl = encodeURIComponent(window.location.href)
  const qrImg = document.getElementById('qr-img')
  if (qrImg) qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + pageUrl
}

let arStarted = false
let tapEnabled = false

const showPreview = () => {
  document.getElementById('preview-page').style.display = 'flex'
  document.getElementById('ar-view').style.display = 'none'
  if (arStarted) {
    try {
      XR8.stop()
      arStarted = false
    } catch (e) {
      console.log('AR stop error:', e)
    }
  }
}

const showARView = () => {
  document.getElementById('preview-page').style.display = 'none'
  document.getElementById('ar-view').style.display = 'block'
}

const createBackButton = () => {
  const existing = document.getElementById('back-btn-ar')
  if (existing) existing.remove()
  const btn = document.createElement('button')
  btn.id = 'back-btn-ar'
  btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  btn.setAttribute('style', [
    'position:fixed',
    'top:20px',
    'left:20px',
    'z-index:2147483647',
    'width:44px',
    'height:44px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'background:rgba(255,255,255,0.9)',
    'border:none',
    'border-radius:50%',
    'cursor:pointer',
    'box-shadow:0 2px 10px rgba(0,0,0,0.2)',
    'transform:translateZ(0)',
    'pointer-events:auto',
    'color:#333',
  ].join(' !important;') + ' !important')
  btn.addEventListener('click', () => { window.location.reload() })
  document.body.appendChild(btn)
  return btn
}

const showOverlay = () => {
  document.getElementById('overlay').style.display = 'block'
  setTimeout(() => {
    createBackButton()
    setInterval(() => {
      const btn = document.getElementById('back-btn-ar')
      if (!btn || !btn.parentNode) {
        createBackButton()
      } else if (btn.style.display === 'none' || btn.style.visibility === 'hidden') {
        btn.style.setProperty('display', 'flex', 'important')
        btn.style.setProperty('visibility', 'visible', 'important')
      }
    }, 500)
  }, 1500)
}

const showTapIndicator = () => {
  document.getElementById('tap-indicator').style.display = 'flex'
}

const hideTapIndicator = () => {
  const tapIndicator = document.getElementById('tap-indicator')
  if (tapIndicator) {
    tapIndicator.classList.add('hidden')
    setTimeout(() => {
      tapIndicator.style.display = 'none'
    }, 300)
  }
}

const setTapText = (text) => {
  const el = document.querySelector('.tap-text')
  if (el) el.textContent = text
}

const resetTapIndicatorPosition = () => {
  const el = document.getElementById('tap-indicator')
  if (el) {
    el.style.top = '50%'
    el.style.left = '50%'
    el.style.transform = 'translate(-50%, -50%)'
  }
}

const showToast = (msg, duration) => {
  const el = document.getElementById('ar-toast')
  if (!el) return
  el.textContent = msg
  el.style.display = 'block'
  setTimeout(() => { el.style.opacity = '1' }, 30)
  if (duration) {
    setTimeout(() => {
      el.style.opacity = '0'
      setTimeout(() => { el.style.display = 'none' }, 400)
    }, duration)
  }
}

let scaleLabelTimer = null
const showScaleLabel = (percent) => {
  const label = document.getElementById('scale-label')
  if (!label) return
  label.textContent = percent + '%'
  label.style.opacity = '1'
  label.classList.remove('fade-out')
  clearTimeout(scaleLabelTimer)
  scaleLabelTimer = setTimeout(() => {
    label.classList.add('fade-out')
    setTimeout(() => {
      label.style.opacity = '0'
      label.classList.remove('fade-out')
    }, 300)
  }, 1000)
}

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

const makeDimSprite = (text) => {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const ctx = c.getContext('2d')
  ctx.fillStyle = 'rgba(0,0,0,0.75)'
  roundRect(ctx, 0, 0, 512, 128, 20)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 72px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 256, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({map: tex, transparent: true, depthTest: false})
  return new THREE.Sprite(mat)
}

const makeGlowStrip = (x1, y1, x2, y2, z, thickness) => {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const angle = Math.atan2(dy, dx)

  const glowMat = new THREE.MeshBasicMaterial({color: 0x00ffff, transparent: true, opacity: 0.35, depthTest: false, side: THREE.DoubleSide})
  const glowGeo = new THREE.PlaneGeometry(len, thickness * 4)
  const glow = new THREE.Mesh(glowGeo, glowMat)
  glow.position.set(cx, cy, z - 0.0005)
  glow.rotation.z = angle

  const coreMat = new THREE.MeshBasicMaterial({color: 0x00ffff, transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide})
  const coreGeo = new THREE.PlaneGeometry(len, thickness)
  const core = new THREE.Mesh(coreGeo, coreMat)
  core.position.set(cx, cy, z)
  core.rotation.z = angle

  return [glow, core]
}

const createDimensionArrows = (artGroup, localBbox) => {
  const w = localBbox.max.x - localBbox.min.x
  const h = localBbox.max.y - localBbox.min.y
  const wCm = Math.round(w * 100)
  const hCm = Math.round(h * 100)

  const gap = 0.025
  const tick = 0.015
  const z = 0.003
  const thick = 0.002

  const strips = []
  const addStrip = (x1, y1, x2, y2) => {
    const meshes = makeGlowStrip(x1, y1, x2, y2, z, thick)
    meshes.forEach(m => artGroup.add(m))
    strips.push(...meshes)
  }

  const tY = localBbox.max.y + gap
  addStrip(localBbox.min.x, tY, localBbox.max.x, tY)
  addStrip(localBbox.min.x, tY - tick, localBbox.min.x, tY + tick)
  addStrip(localBbox.max.x, tY - tick, localBbox.max.x, tY + tick)

  const wSprite = makeDimSprite(wCm + ' cm')
  wSprite.position.set((localBbox.min.x + localBbox.max.x) / 2, tY + 0.035, z)
  wSprite.center.set(0.5, 0.5)
  artGroup.add(wSprite)

  const rX = localBbox.max.x + gap
  addStrip(rX, localBbox.min.y, rX, localBbox.max.y)
  addStrip(rX - tick, localBbox.min.y, rX + tick, localBbox.min.y)
  addStrip(rX - tick, localBbox.max.y, rX + tick, localBbox.max.y)

  const hSprite = makeDimSprite(hCm + ' cm')
  hSprite.position.set(rX + 0.035, (localBbox.min.y + localBbox.max.y) / 2, z)
  hSprite.center.set(0.5, 0.5)
  artGroup.add(hSprite)

  return {sprites: [wSprite, hSprite], strips}
}

const createDimToggle = (onToggle) => {
  const existing = document.getElementById('dim-toggle-btn')
  if (existing) existing.remove()
  const btn = document.createElement('button')
  btn.id = 'dim-toggle-btn'
  btn.textContent = 'Hide Markers'
  btn.setAttribute('style', [
    'position:fixed',
    'bottom:40px',
    'right:20px',
    'z-index:2147483647',
    'padding:10px 18px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'background:rgba(0,0,0,0.7)',
    'border:1px solid rgba(255,255,255,0.3)',
    'border-radius:25px',
    'cursor:pointer',
    'color:#fff',
    'font-size:13px',
    'font-weight:600',
    'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
    'pointer-events:auto',
    'backdrop-filter:blur(8px)',
    '-webkit-backdrop-filter:blur(8px)',
  ].join(' !important;') + ' !important')
  btn.addEventListener('click', () => {
    onToggle()
  })
  document.body.appendChild(btn)
  return btn
}

const makeFloorMarker = (scene) => {
  const group = new THREE.Group()
  const radius = 0.3
  const ringGeo = new THREE.RingGeometry(radius - 0.02, radius, 48)
  const ringMat = new THREE.MeshBasicMaterial({color: 0x00ccff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false})
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.002
  group.add(ring)

  const innerGeo = new THREE.CircleGeometry(radius - 0.02, 48)
  const innerMat = new THREE.MeshBasicMaterial({color: 0x00ccff, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false})
  const inner = new THREE.Mesh(innerGeo, innerMat)
  inner.rotation.x = -Math.PI / 2
  inner.position.y = 0.001
  group.add(inner)

  const crossSize = radius * 0.4
  const crossMat = new THREE.LineBasicMaterial({color: 0xffffff})
  const hPts = [new THREE.Vector3(-crossSize, 0.003, 0), new THREE.Vector3(crossSize, 0.003, 0)]
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hPts), crossMat))
  const vPts = [new THREE.Vector3(0, 0.003, -crossSize), new THREE.Vector3(0, 0.003, crossSize)]
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(vPts), crossMat))

  scene.add(group)
  return group
}

const makeGridPlane = (scene) => {
  const group = new THREE.Group()
  const gridSize = 0.6
  const divisions = 6
  const floorGeo = new THREE.PlaneGeometry(gridSize, gridSize)
  const floorMat = new THREE.MeshBasicMaterial({color: 0x00aaff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false})
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0.001
  group.add(floor)

  const wallGeo = new THREE.PlaneGeometry(gridSize, gridSize)
  const wallMat = new THREE.MeshBasicMaterial({color: 0xaa44ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false})
  const wall = new THREE.Mesh(wallGeo, wallMat)
  wall.position.y = gridSize / 2
  wall.position.z = -gridSize / 2
  group.add(wall)

  const floorEdgeMat = new THREE.LineBasicMaterial({color: 0x0099ff})
  const wallEdgeMat = new THREE.LineBasicMaterial({color: 0x9944dd})
  const step = gridSize / divisions
  for (let i = 0; i <= divisions; i++) {
    const t = -gridSize / 2 + i * step
    const fPts = [new THREE.Vector3(t, 0.002, -gridSize / 2), new THREE.Vector3(t, 0.002, gridSize / 2)]
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fPts), floorEdgeMat))
    const fPts2 = [new THREE.Vector3(-gridSize / 2, 0.002, t), new THREE.Vector3(gridSize / 2, 0.002, t)]
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fPts2), floorEdgeMat))
    const wPts = [new THREE.Vector3(t, 0, -gridSize / 2), new THREE.Vector3(t, gridSize, -gridSize / 2)]
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wPts), wallEdgeMat))
    const wPts2 = [new THREE.Vector3(-gridSize / 2, i * step, -gridSize / 2), new THREE.Vector3(gridSize / 2, i * step, -gridSize / 2)]
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wPts2), wallEdgeMat))
  }

  const hingeMat = new THREE.LineBasicMaterial({color: 0xffffff, linewidth: 2})
  const hingePts = [new THREE.Vector3(-gridSize / 2, 0.003, -gridSize / 2), new THREE.Vector3(gridSize / 2, 0.003, -gridSize / 2)]
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hingePts), hingeMat))

  scene.add(group)
  return group
}

const rugARScenePipelineModule = () => {
  const placementMode = document.getElementById('preview-page').dataset.placement || 'wall'

  const startScale = new THREE.Vector3(0.01, 0.01, 0.01)
  const endScale = new THREE.Vector3(1, 1, 1)
  const animationMillis = 500

  THREE.ColorManagement.enabled = false

  let placedArt = null
  let artModelTemplate = null
  let modelLoaded = false
  let dimElements = null
  let dimVisible = true
  const loader = new THREE.GLTFLoader()

  let scaleFactor = 1
  let targetScaleFactor = 1
  const scaleMin = 0.1
  const scaleMax = 5
  let initialScale = {x: 1, y: 1, z: 1}

  let isPinching = false
  let startPinchDistance = 0
  let lastPinchDistance = 0
  let lastRotationAngle = 0

  let touchStartPos = null
  let touchStartTime = 0
  let isDragging = false

  const dragTarget = new THREE.Vector3()
  const dragLerpFactor = 0.25
  const scaleLerpFactor = 0.3
  let lastHitTestTime = 0
  const hitTestInterval = 33

  let phase = 'scanning'
  const raycaster = new THREE.Raycaster()
  let groundMesh = null
  let virtualWall = null
  let wallMarker = null
  let floorMarker = null

  const preloadModel = () => {
    return new Promise((resolve, reject) => {
      loader.load(
        RUG_MODEL_URL,
        (gltf) => {
          artModelTemplate = gltf.scene
          artModelTemplate.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = false
              child.receiveShadow = false
              if (child.material) {
                child.material.side = THREE.DoubleSide
                child.material.needsUpdate = true
              }
            }
          })
          modelLoaded = true
          console.log('Art model preloaded successfully')
          resolve(gltf)
        },
        (progress) => {
          console.log('Loading model:', (progress.loaded / progress.total * 100).toFixed(0) + '%')
        },
        (error) => {
          console.error('Error loading art model:', error)
          reject(error)
        }
      )
    })
  }

  const initXrScene = ({scene, camera, renderer}) => {
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const light = new THREE.DirectionalLight(0xffffff, 0.8)
    light.position.set(0, 10, 0)
    light.castShadow = false
    scene.add(light)

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1)
    hemiLight.position.set(0, 10, 0)
    scene.add(hemiLight)

    scene.add(new THREE.AmbientLight(0xffffff, 0.8))

    camera.position.set(0, 1.6, 0)

    const gGeo = new THREE.PlaneGeometry(200, 200)
    const gMat = new THREE.MeshBasicMaterial({visible: false, side: THREE.DoubleSide})
    groundMesh = new THREE.Mesh(gGeo, gMat)
    groundMesh.rotation.x = -Math.PI / 2
    groundMesh.position.y = 0
    scene.add(groundMesh)

    preloadModel()
  }

  const createArtFromModel = () => {
    if (!artModelTemplate) {
      console.warn('Model not loaded yet')
      return null
    }
    const art = artModelTemplate.clone()
    art.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false
        child.receiveShadow = false
        if (child.material) {
          child.material.side = THREE.DoubleSide
          child.material.needsUpdate = true
        }
      }
    })
    return art
  }

  const animateIn = (art) => {
    const scale = {...startScale}
    art.scale.set(scale.x, scale.y, scale.z)

    new TWEEN.Tween(scale)
      .to(endScale, animationMillis)
      .easing(TWEEN.Easing.Elastic.Out)
      .onUpdate(() => {
        art.scale.set(scale.x, scale.y, scale.z)
      })
      .onComplete(() => {
        initialScale = {x: art.scale.x, y: art.scale.y, z: art.scale.z}
        scaleFactor = 1
        targetScaleFactor = 1
        const localBbox = new THREE.Box3().setFromObject(artModelTemplate)
        requestAnimationFrame(() => {
          dimElements = createDimensionArrows(art, localBbox)
          createDimToggle(() => {
            dimVisible = !dimVisible
            const allMeshes = [...dimElements.sprites, ...dimElements.strips]
            allMeshes.forEach(m => { m.visible = dimVisible })
            const tbtn = document.getElementById('dim-toggle-btn')
            if (tbtn) tbtn.textContent = dimVisible ? 'Hide Markers' : 'Show Markers'
          })
        })
        showToast('Pinch to scale \u2022 Drag to move', 4000)
      })
      .start()
  }

  const handleFloorTap = (x, y) => {
    if (phase === 'scanning') {
      if (!floorMarker || !floorMarker.visible) {
        showToast('Point at the floor to place', 2000)
        return
      }
      const art = createArtFromModel()
      if (art) {
        placedArt = art
        scaleFactor = 1
        targetScaleFactor = 1
        art.position.copy(floorMarker.position)
        XR8.Threejs.xrScene().scene.add(art)
        floorMarker.visible = false
        phase = 'placed'
        hideTapIndicator()
        animateIn(placedArt)
      } else {
        showToast('Loading model... please wait', 2000)
      }
    }
  }

  const handleWallTap = (x, y, camera) => {
    if (phase === 'scanning') {
      if (!wallMarker || !wallMarker.visible) {
        showToast('Point at the floor near the wall base', 2000)
        return
      }
      const wallNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(wallMarker.quaternion)
      const wallPos = wallMarker.position.clone().add(wallNormal.clone().multiplyScalar(-0.3))
      const wGeo = new THREE.PlaneGeometry(200, 200)
      const wMat = new THREE.MeshBasicMaterial({visible: false, side: THREE.DoubleSide})
      virtualWall = new THREE.Mesh(wGeo, wMat)
      virtualWall.position.copy(wallPos)
      virtualWall.lookAt(wallPos.clone().add(wallNormal))
      XR8.Threejs.xrScene().scene.add(virtualWall)

      wallMarker.visible = false

      const art = createArtFromModel()
      if (art) {
        placedArt = art
        scaleFactor = 1
        targetScaleFactor = 1
        art.quaternion.copy(virtualWall.quaternion)
        art.position.copy(virtualWall.position.clone().add(new THREE.Vector3(0, 1, 0)))
        XR8.Threejs.xrScene().scene.add(art)
        art.scale.set(1, 1, 1)

        phase = 'wall-aim'
        setTapText('Tap to place')
        document.getElementById('crosshair').style.display = 'block'
        showToast('Move to position & tap to place', 3000)
      } else {
        showToast('Loading model... please wait', 2000)
      }
    } else if (phase === 'wall-aim') {
      if (placedArt) {
        phase = 'placed'
        initialScale = {x: placedArt.scale.x, y: placedArt.scale.y, z: placedArt.scale.z}
        scaleFactor = 1
        targetScaleFactor = 1
        document.getElementById('crosshair').style.display = 'none'
        hideTapIndicator()
        const localBbox = new THREE.Box3().setFromObject(artModelTemplate)
        requestAnimationFrame(() => {
          dimElements = createDimensionArrows(placedArt, localBbox)
          createDimToggle(() => {
            dimVisible = !dimVisible
            const allMeshes = [...dimElements.sprites, ...dimElements.strips]
            allMeshes.forEach(m => { m.visible = dimVisible })
            const tbtn = document.getElementById('dim-toggle-btn')
            if (tbtn) tbtn.textContent = dimVisible ? 'Hide Markers' : 'Show Markers'
          })
        })
        showToast('Pinch to scale \u2022 Drag to move', 4000)
      }
    }
  }

  const getPinchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const getRotationAngle = (touches) => {
    return Math.atan2(
      touches[1].clientY - touches[0].clientY,
      touches[1].clientX - touches[0].clientX
    )
  }

  const touchStartHandler = (e) => {
    if (!tapEnabled) return
    e.preventDefault()

    if (e.touches.length === 2 && placedArt) {
      isPinching = true
      isDragging = false
      startPinchDistance = getPinchDistance(e.touches)
      lastPinchDistance = startPinchDistance
      lastRotationAngle = getRotationAngle(e.touches)
      return
    }

    if (e.touches.length === 1) {
      touchStartPos = {x: e.touches[0].clientX, y: e.touches[0].clientY}
      touchStartTime = Date.now()
      isDragging = false
    }
  }

  const touchMoveHandler = (e) => {
    if (!tapEnabled) return
    e.preventDefault()

    if (isPinching && e.touches.length === 2 && placedArt) {
      const newDistance = getPinchDistance(e.touches)
      const spreadChange = newDistance - lastPinchDistance
      if (Math.abs(spreadChange) > 1) {
        targetScaleFactor *= 1 + spreadChange / startPinchDistance
        targetScaleFactor = Math.max(scaleMin, Math.min(scaleMax, targetScaleFactor))
      }
      lastPinchDistance = newDistance

      const newAngle = getRotationAngle(e.touches)
      const angleDelta = newAngle - lastRotationAngle
      if (Math.abs(angleDelta) > 0.005) {
        if (placementMode === 'wall' && virtualWall) {
          const wallNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(virtualWall.quaternion)
          placedArt.rotateOnWorldAxis(wallNormal, angleDelta)
        } else {
          placedArt.rotateY(angleDelta)
        }
      }
      lastRotationAngle = newAngle
      return
    }

    if (e.touches.length === 1 && placedArt && touchStartPos && phase === 'placed') {
      const dx = e.touches[0].clientX - touchStartPos.x
      const dy = e.touches[0].clientY - touchStartPos.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > 10) {
        isDragging = true
        const now = Date.now()
        if (now - lastHitTestTime < hitTestInterval) return
        lastHitTestTime = now
        const touch = e.touches[0]
        if (placementMode === 'wall' && virtualWall) {
          const ndc = new THREE.Vector2(
            (touch.clientX / window.innerWidth) * 2 - 1,
            -(touch.clientY / window.innerHeight) * 2 + 1
          )
          const cam = XR8.Threejs.xrScene().camera
          raycaster.setFromCamera(ndc, cam)
          const hits = raycaster.intersectObject(virtualWall)
          if (hits.length > 0) {
            dragTarget.copy(hits[0].point)
          }
        } else {
          const x = touch.clientX / window.innerWidth
          const y = touch.clientY / window.innerHeight
          const hitTestResults = XR8.XrController.hitTest(x, y, ['FEATURE_POINT'])
          if (hitTestResults.length > 0) {
            const hit = hitTestResults[0]
            dragTarget.set(hit.position.x, hit.position.y, hit.position.z)
          }
        }
      }
    }
  }

  const touchEndHandler = (e) => {
    if (e.touches.length < 2) {
      isPinching = false
    }
    if (e.touches.length === 0 && touchStartPos) {
      if (!isDragging && (Date.now() - touchStartTime) < 300) {
        const x = touchStartPos.x / window.innerWidth
        const y = touchStartPos.y / window.innerHeight
        const camera = XR8.Threejs.xrScene().camera
        if (placementMode === 'wall') {
          handleWallTap(x, y, camera)
        } else {
          handleFloorTap(x, y)
        }
      }
      touchStartPos = null
      isDragging = false
    }
  }

  return {
    name: 'rug-ar',

    onStart: ({canvas}) => {
      pipelineStarted = true
      dbg('PIPELINE onStart fired!')
      const {scene, camera, renderer} = XR8.Threejs.xrScene()
      dbg('xrScene obtained: scene=' + !!scene + ' camera=' + !!camera + ' renderer=' + !!renderer)
      initXrScene({scene, camera, renderer})
      dbg('initXrScene done')

      canvas.addEventListener('touchstart', touchStartHandler, true)
      canvas.addEventListener('touchmove', touchMoveHandler, {passive: false, capture: true})
      canvas.addEventListener('touchend', touchEndHandler, true)

      const animate = (time) => {
        requestAnimationFrame(animate)
        TWEEN.update(time)

        if (placementMode === 'floor' && phase === 'scanning' && floorMarker && tapEnabled) {
          const cam = XR8.Threejs.xrScene().camera
          const ndc = new THREE.Vector2(0, 0)
          raycaster.setFromCamera(ndc, cam)
          if (groundMesh) {
            const hits = raycaster.intersectObject(groundMesh)
            if (hits.length > 0) {
              const pt = hits[0].point
              floorMarker.position.set(pt.x, 0, pt.z)
              floorMarker.visible = true
              const screenPos = new THREE.Vector3(pt.x, 0.002, pt.z).project(cam)
              const sx = (screenPos.x * 0.5 + 0.5) * window.innerWidth
              const sy = (-screenPos.y * 0.5 + 0.5) * window.innerHeight
              const el = document.getElementById('tap-indicator')
              if (el && el.style.display !== 'none') {
                el.style.left = sx + 'px'
                el.style.top = sy + 'px'
                el.style.transform = 'translate(-50%, -50%)'
              }
            } else {
              floorMarker.visible = false
            }
          }
        }

        if (placementMode === 'wall' && phase === 'scanning' && wallMarker && tapEnabled) {
          const cam = XR8.Threejs.xrScene().camera
          const ndc = new THREE.Vector2(0, 0)
          raycaster.setFromCamera(ndc, cam)
          if (groundMesh) {
            const hits = raycaster.intersectObject(groundMesh)
            if (hits.length > 0) {
              const pt = hits[0].point
              wallMarker.position.set(pt.x, 0, pt.z)
              wallMarker.lookAt(cam.position.x, 0, cam.position.z)
              wallMarker.visible = true
              const gs = 0.6
              const wallCenter = new THREE.Vector3(0, gs / 2, -gs / 2)
              wallCenter.applyMatrix4(wallMarker.matrixWorld)
              const screenPos = wallCenter.clone().project(cam)
              const sx = (screenPos.x * 0.5 + 0.5) * window.innerWidth
              const sy = (-screenPos.y * 0.5 + 0.5) * window.innerHeight
              const el = document.getElementById('tap-indicator')
              if (el && el.style.display !== 'none') {
                el.style.left = sx + 'px'
                el.style.top = sy + 'px'
                el.style.transform = 'translate(-50%, -50%)'
              }
            } else {
              wallMarker.visible = false
            }
          }
        }

        if (placementMode === 'wall' && phase === 'wall-aim' && placedArt && virtualWall) {
          const cam = XR8.Threejs.xrScene().camera
          const ndc = new THREE.Vector2(0, 0)
          raycaster.setFromCamera(ndc, cam)
          const hits = raycaster.intersectObject(virtualWall)
          if (hits.length > 0) {
            const hitPt = hits[0].point
            hitPt.y = Math.max(hitPt.y, virtualWall.position.y + 0.5)
            placedArt.position.lerp(hitPt, 0.3)
            const screenPos = placedArt.position.clone().project(cam)
            const sx = (screenPos.x * 0.5 + 0.5) * window.innerWidth
            const sy = (-screenPos.y * 0.5 + 0.5) * window.innerHeight
            const el = document.getElementById('tap-indicator')
            if (el && el.style.display !== 'none') {
              el.style.left = sx + 'px'
              el.style.top = sy + 'px'
              el.style.transform = 'translate(-50%, -50%)'
            }
          }
        }

        if (placedArt && phase === 'placed') {
          if (isDragging) {
            placedArt.position.lerp(dragTarget, dragLerpFactor)
          }

          if (dimElements && dimVisible) {
            const cam = XR8.Threejs.xrScene().camera
            const tempVec = new THREE.Vector3()
            placedArt.getWorldPosition(tempVec)
            const dist = cam.position.distanceTo(tempVec)
            const parentS = placedArt.scale.x / initialScale.x
            const inv = 1 / Math.max(parentS, 0.01)
            const spriteS = dist * 0.12 * inv
            dimElements.sprites.forEach((sprite) => {
              sprite.scale.set(spriteS, spriteS * 0.25, 1)
            })
            dimElements.strips.forEach((mesh) => {
              mesh.scale.y = 1
            })
          }

          if (isPinching) {
            scaleFactor += (targetScaleFactor - scaleFactor) * scaleLerpFactor
            let displayPercent
            if (targetScaleFactor >= 0.9 && targetScaleFactor <= 1.1) {
              placedArt.scale.set(initialScale.x, initialScale.y, initialScale.z)
              displayPercent = 100
            } else {
              placedArt.scale.set(
                scaleFactor * initialScale.x,
                scaleFactor * initialScale.y,
                scaleFactor * initialScale.z
              )
              displayPercent = Math.round(scaleFactor * 100)
            }
            showScaleLabel(displayPercent)
          }
        }
      }
      animate()

      XR8.XrController.updateCameraProjectionMatrix({
        origin: camera.position,
        facing: camera.quaternion,
      })

      showOverlay()
      const enableWhenReady = () => {
        if (modelLoaded) {
          tapEnabled = true
          if (placementMode === 'wall') {
            setTapText('Align with wall base & Tap')
            wallMarker = makeGridPlane(XR8.Threejs.xrScene().scene)
            wallMarker.visible = false
          } else if (placementMode === 'floor') {
            setTapText('Point at floor & Tap')
            floorMarker = makeFloorMarker(XR8.Threejs.xrScene().scene)
            floorMarker.visible = false
          }
          showTapIndicator()
          console.log('Tap-to-place enabled (mode: ' + placementMode + ')')
        } else {
          showToast('Loading model...', 1500)
          setTimeout(enableWhenReady, 500)
        }
      }
      setTimeout(enableWhenReady, 1000)
    },
  }
}

const setupAndRun = () => {
  dbg('setupAndRun called')
  try {
    dbg('XR8.XrController exists: ' + !!XR8.XrController)
    XR8.XrController.configure({scale: 'absolute'})
    dbg('XrController configured')

    const isAndroid = getDevice() === 'android'
    const inApp = isInAppBrowser()
    const modules = [
      XR8.GlTextureRenderer.pipelineModule(),
      XR8.Threejs.pipelineModule(),
      XR8.XrController.pipelineModule(),
      rugARScenePipelineModule(),
    ]
    if (!isAndroid) {
      modules.splice(3, 0, XRExtras.AlmostThere.pipelineModule())
      modules.splice(4, 0, XRExtras.FullWindowCanvas.pipelineModule())
      modules.splice(5, 0, XRExtras.Loading.pipelineModule())
      modules.splice(6, 0, XRExtras.RuntimeError.pipelineModule())
    } else if (!inApp) {
      modules.splice(3, 0, XRExtras.FullWindowCanvas.pipelineModule())
    }
    XR8.addCameraPipelineModules(modules)
    dbg('Pipeline modules added (android=' + isAndroid + ' inApp=' + inApp + ')')

    const canvas = document.getElementById('camerafeed')
    if (isAndroid && inApp) {
      canvas.width = window.innerWidth * window.devicePixelRatio
      canvas.height = window.innerHeight * window.devicePixelRatio
      dbg('Canvas manually sized to ' + canvas.width + 'x' + canvas.height)
    }
    dbg('Canvas found: ' + !!canvas + ', size: ' + canvas.width + 'x' + canvas.height)
    dbg('WebGL context: ' + !!(canvas.getContext('webgl2') || canvas.getContext('webgl')))
    XR8.run({canvas})
    dbg('XR8.run() called')
    setTimeout(() => {
      const c = document.getElementById('camerafeed')
      dbg('POST-RUN (1s): canvas size=' + c.width + 'x' + c.height + ' display=' + c.style.display + ' visibility=' + getComputedStyle(c).visibility)
      const arView = document.getElementById('ar-view')
      dbg('POST-RUN (1s): ar-view display=' + arView.style.display + ' computed=' + getComputedStyle(arView).display)
      const gl = c.getContext('webgl2') || c.getContext('webgl')
      dbg('POST-RUN (1s): gl context=' + !!gl + ' lost=' + (gl ? gl.isContextLost() : 'N/A'))
    }, 1000)
    setTimeout(() => {
      const c = document.getElementById('camerafeed')
      dbg('POST-RUN (3s): canvas size=' + c.width + 'x' + c.height)
      const gl = c.getContext('webgl2') || c.getContext('webgl')
      dbg('POST-RUN (3s): gl context=' + !!gl + ' lost=' + (gl ? gl.isContextLost() : 'N/A'))
    }, 3000)
  } catch (e) {
    dbg('ERROR in setupAndRun: ' + e.message)
  }
}

const startAR = () => {
  dbg('startAR called')
  try {
    showARView()
    dbg('showARView done')
    dbg('XRExtras exists: ' + (typeof XRExtras !== 'undefined'))
    dbg('XR8 exists: ' + (typeof XR8 !== 'undefined'))
    dbg('XR8.XrController exists: ' + !!(typeof XR8 !== 'undefined' && XR8.XrController))
    if (getDevice() === 'android') {
      dbg('Android: bypassing XRExtras.Loading, calling setupAndRun directly')
      setupAndRun()
    } else {
      XRExtras.Loading.showLoading({onxrloaded: setupAndRun})
      dbg('showLoading called')
    }
  } catch (e) {
    dbg('ERROR in startAR: ' + e.message)
  }
}

const enableARButton = () => {
  const btn = document.getElementById('view-ar-btn')
  btn.disabled = false
  btn.classList.remove('loading')
  btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> View in AR'
}

const waitForARReady = () => {
  const check = () => {
    if (typeof XRExtras !== 'undefined' && typeof XR8 !== 'undefined') {
      dbg('AR ready: XRExtras + XR8 loaded')
      enableARButton()
    } else {
      dbg('Waiting... XRExtras:' + (typeof XRExtras !== 'undefined') + ' XR8:' + (typeof XR8 !== 'undefined'))
      setTimeout(check, 200)
    }
  }
  check()
}

document.addEventListener('DOMContentLoaded', () => {
  dbg('DOMContentLoaded fired')
  dbg('UA: ' + navigator.userAgent)
  const previewPage = document.getElementById('preview-page')
  const arMode = previewPage.dataset.arMode || 'auto'
  const route = resolveARRoute(arMode)
  dbg('device=' + getDevice() + ' arMode=' + arMode + ' route=' + route)
  const arBtn = document.getElementById('view-ar-btn')
  const mv = document.getElementById('model-viewer')

  if (route === 'qrcode') {
    dbg('Route: QR code (desktop)')
    arBtn.style.display = 'none'
    showQROverlay()
    return
  }

  if (route === 'sceneviewer-direct') {
    dbg('Route: Android in-app browser → Scene Viewer direct')
    const placement = previewPage.dataset.placement || 'floor'
    arBtn.disabled = false
    arBtn.addEventListener('click', () => {
      launchSceneViewerDirect(RUG_MODEL_URL, placement)
    })
    return
  }

  if (route === 'modelviewer-webxr-android') {
    dbg('Route: Android → model-viewer WebXR first, Scene Viewer fallback')
    const placement = previewPage.dataset.placement || 'floor'
    mv.setAttribute('ar-placement', placement)
    mv.setAttribute('ar-scale', 'auto')
    arBtn.disabled = false
    arBtn.addEventListener('click', async () => {
      let webxrSupported = false
      try {
        if (navigator.xr) {
          webxrSupported = await navigator.xr.isSessionSupported('immersive-ar')
        }
      } catch (e) {
        dbg('WebXR check error: ' + e.message)
      }
      if (webxrSupported) {
        dbg('Android: WebXR supported → model-viewer WebXR')
        mv.setAttribute('ar-modes', 'webxr')
        if (mv.updateComplete) await mv.updateComplete
        if (mv.activateAR) mv.activateAR()
      } else {
        dbg('Android: WebXR not supported → Scene Viewer (occlusion enabled)')
        launchSceneViewerDirect(RUG_MODEL_URL, placement)
      }
    })
    return
  }

  if (route === 'quicklook') {
    dbg('Route: native (quicklook)')
    mv.setAttribute('ar-modes', 'quick-look')
    mv.setAttribute('ar-scale', 'auto')
    mv.setAttribute('ar-placement', previewPage.dataset.placement || 'floor')
    arBtn.disabled = false
    arBtn.addEventListener('click', triggerNativeAR)
    return
  }

  dbg('Route: webxr (8th Wall)')
  arBtn.disabled = true
  arBtn.classList.add('loading')
  arBtn.textContent = 'Loading AR...'
  arBtn.addEventListener('click', startAR)
  waitForARReady()
})
