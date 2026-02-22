// Rugs3D - 8th Wall WebAR Test App
// Self-hosted 8th Wall engine for World Effects (SLAM tracking)
// Dual-mode placement: Wall (2-step) + Floor (1-step)

/* globals XR8 XRExtras THREE TWEEN */

performance.mark('rugs3d-script-start')

const RUG_MODEL_URL = 'https://dfcksvowcprcrpkpfptk.supabase.co/storage/v1/object/public/3d-models/models/2A0pQDoKVq/carpet_model_20260210_094217.glb'

let arStarted = false
let tapEnabled = false

const perfLog = (label) => {
  performance.mark('rugs3d-' + label)
  try {
    performance.measure(label, 'rugs3d-script-start', 'rugs3d-' + label)
    const entry = performance.getEntriesByName(label).pop()
    console.log('[Perf] ' + label + ': ' + Math.round(entry.duration) + 'ms')
  } catch (e) { /* ignore */ }
}

const showPreview = () => {
  document.getElementById('preview-page').style.display = 'flex'
  document.getElementById('ar-view').style.display = 'none'
  const mt = document.getElementById('mode-toggle')
  if (mt) mt.style.display = 'none'
  document.getElementById('crosshair').style.display = 'none'
  hideTapIndicator()
  const dtb = document.getElementById('dim-toggle-btn')
  if (dtb) dtb.remove()
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
  const el = document.getElementById('tap-indicator')
  if (el) {
    el.classList.remove('hidden')
    el.style.display = 'flex'
  }
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
    el.style.left = '50%'
    el.style.top = '50%'
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

const makeGridPlane = (type, width, height) => {
  const isFloor = type === 'floor'
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = isFloor ? 'rgba(0, 180, 255, 0.3)' : 'rgba(121, 22, 255, 0.3)'
  ctx.fillRect(0, 0, 256, 256)

  ctx.strokeStyle = isFloor ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 1.5
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 4
  ctx.beginPath(); ctx.moveTo(0, 256); ctx.lineTo(256, 256); ctx.stroke()

  ctx.strokeStyle = isFloor ? 'rgba(0,180,255,0.8)' : 'rgba(121,22,255,0.8)'
  ctx.lineWidth = 3
  ctx.strokeRect(0, 0, 256, 256)

  const texture = new THREE.CanvasTexture(canvas)
  const mat = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, opacity: 1.0,
    side: THREE.DoubleSide, depthWrite: false
  })
  const geo = new THREE.PlaneGeometry(width, height)
  return new THREE.Mesh(geo, mat)
}

const rugARScenePipelineModule = () => {
  const animationMillis = 500

  THREE.ColorManagement.enabled = false

  let sceneRef = null
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

  let mode = 'wall'
  let phase = 'scanning'

  const raycaster = new THREE.Raycaster()
  let groundMesh = null
  let virtualWall = null
  let wallMarker = null
  let floorMarker = null
  let floorMarkerPlane = null

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
          perfLog('glb-model-loaded')
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

  const cleanupDimensions = () => {
    if (dimElements) {
      dimElements.sprites.forEach(s => { if (s.parent) s.parent.remove(s) })
      dimElements.strips.forEach(s => { if (s.parent) s.parent.remove(s) })
      dimElements = null
    }
    dimVisible = true
    const dtb = document.getElementById('dim-toggle-btn')
    if (dtb) dtb.remove()
  }

  const setupDimensions = () => {
    if (!placedArt || !artModelTemplate) return
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
  }

  const startMode = (newMode) => {
    mode = newMode
    phase = 'scanning'

    cleanupDimensions()

    if (placedArt) {
      sceneRef.remove(placedArt)
      placedArt = null
    }

    if (virtualWall) {
      sceneRef.remove(virtualWall)
      virtualWall = null
    }

    scaleFactor = 1
    targetScaleFactor = 1

    wallMarker.visible = (mode === 'wall')
    floorMarker.visible = (mode === 'floor')

    document.getElementById('crosshair').style.display = 'none'

    if (mode === 'wall') {
      setTapText('Align corner with wall base & tap')
    } else {
      setTapText('Tap on floor to place')
    }
    showTapIndicator()
    resetTapIndicatorPosition()
  }

  const initXrScene = ({scene, camera, renderer}) => {
    sceneRef = scene
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

    const groundGeo = new THREE.BoxGeometry(1000, 2, 1000)
    const groundMat = new THREE.MeshBasicMaterial({visible: false})
    groundMesh = new THREE.Mesh(groundGeo, groundMat)
    groundMesh.position.set(0, -1, 0)
    scene.add(groundMesh)

    const wallMarkerFloor = makeGridPlane('floor', 0.6, 0.4)
    wallMarkerFloor.rotation.x = -Math.PI / 2
    wallMarkerFloor.position.set(0, 0.003, 0.2)

    const wallMarkerWall = makeGridPlane('wall', 0.6, 0.4)
    wallMarkerWall.position.set(0, 0.2, -0.003)

    wallMarker = new THREE.Group()
    wallMarker.add(wallMarkerFloor)
    wallMarker.add(wallMarkerWall)
    wallMarker.visible = false
    scene.add(wallMarker)

    floorMarkerPlane = makeGridPlane('floor', 0.8, 0.8)
    floorMarkerPlane.rotation.x = -Math.PI / 2

    floorMarker = new THREE.Group()
    floorMarker.add(floorMarkerPlane)
    floorMarker.visible = false
    scene.add(floorMarker)

    preloadModel()
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

    if (e.touches.length === 2 && phase === 'placed' && placedArt) {
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

    if (isPinching && e.touches.length === 2 && phase === 'placed' && placedArt) {
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
        placedArt.rotateY(angleDelta)
      }
      lastRotationAngle = newAngle
      return
    }

    if (e.touches.length === 1 && phase === 'placed' && placedArt && touchStartPos) {
      const dx = e.touches[0].clientX - touchStartPos.x
      const dy = e.touches[0].clientY - touchStartPos.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > 10) {
        isDragging = true
        const now = Date.now()
        if (now - lastHitTestTime < hitTestInterval) return
        lastHitTestTime = now

        const touch = e.touches[0]
        const x = (touch.clientX / window.innerWidth) * 2 - 1
        const y = -(touch.clientY / window.innerHeight) * 2 + 1
        const camera = XR8.Threejs.xrScene().camera
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera)

        if (mode === 'wall' && virtualWall) {
          const hits = raycaster.intersectObject(virtualWall)
          if (hits.length > 0) dragTarget.copy(hits[0].point)
        } else if (mode === 'floor') {
          const hits = raycaster.intersectObject(groundMesh)
          if (hits.length > 0) {
            const pt = hits[0].point
            dragTarget.set(pt.x, 0, pt.z)
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

        if (phase === 'scanning' && mode === 'wall') {
          if (!modelLoaded) {
            showToast('Loading model... please wait', 2000)
          } else {
            const wallGeo = new THREE.BoxGeometry(100, 100, 0.25)
            const wallMat = new THREE.MeshBasicMaterial({visible: false})
            virtualWall = new THREE.Mesh(wallGeo, wallMat)
            virtualWall.rotation.y = wallMarker.rotation.y
            const mPos = wallMarker.position
            virtualWall.position.set(mPos.x, mPos.y + 50, mPos.z)
            sceneRef.add(virtualWall)

            placedArt = createArtFromModel()
            if (placedArt) {
              sceneRef.add(placedArt)
              placedArt.position.copy(wallMarker.position)
              placedArt.rotation.y = wallMarker.rotation.y
              placedArt.visible = true

              wallMarker.visible = false
              phase = 'wall-aim'
              document.getElementById('crosshair').style.display = 'block'
              setTapText('Tap to place')
            }
          }
        }

        else if (phase === 'wall-aim') {
          phase = 'placed'
          document.getElementById('crosshair').style.display = 'none'
          hideTapIndicator()

          initialScale = {x: placedArt.scale.x, y: placedArt.scale.y, z: placedArt.scale.z}
          scaleFactor = 1
          targetScaleFactor = 1

          setupDimensions()
          showToast('Pinch to scale \u2022 Drag to move', 4000)
        }

        else if (phase === 'scanning' && mode === 'floor') {
          if (!modelLoaded) {
            showToast('Loading model... please wait', 2000)
          } else {
            placedArt = createArtFromModel()
            if (placedArt) {
              const camera = XR8.Threejs.xrScene().camera
              const mPos = floorMarker.position
              placedArt.position.set(mPos.x, 0, mPos.z)
              placedArt.rotation.y = camera.rotation.y
              placedArt.visible = true
              placedArt.scale.set(0.01, 0.01, 0.01)
              sceneRef.add(placedArt)

              floorMarker.visible = false
              hideTapIndicator()

              const scale = {x: 0.01, y: 0.01, z: 0.01}
              new TWEEN.Tween(scale)
                .to({x: 1, y: 1, z: 1}, animationMillis)
                .easing(TWEEN.Easing.Elastic.Out)
                .onUpdate(() => {
                  placedArt.scale.set(scale.x, scale.y, scale.z)
                })
                .onComplete(() => {
                  initialScale = {x: 1, y: 1, z: 1}
                  scaleFactor = 1
                  targetScaleFactor = 1
                  phase = 'placed'

                  setupDimensions()
                  showToast('Pinch to scale \u2022 Drag to move', 4000)
                })
                .start()
            }
          }
        }
      }

      touchStartPos = null
      isDragging = false
    }
  }

  return {
    name: 'rug-ar',

    onStart: ({canvas}) => {
      perfLog('ar-pipeline-onstart')
      const {scene, camera, renderer} = XR8.Threejs.xrScene()
      initXrScene({scene, camera, renderer})

      canvas.addEventListener('touchstart', touchStartHandler, true)
      canvas.addEventListener('touchmove', touchMoveHandler, {passive: false, capture: true})
      canvas.addEventListener('touchend', touchEndHandler, true)

      const animate = (time) => {
        requestAnimationFrame(animate)
        TWEEN.update(time)

        const cam = XR8.Threejs.xrScene().camera

        if (phase === 'scanning' && tapEnabled) {
          raycaster.setFromCamera(new THREE.Vector2(0, -0.5), cam)
          const hits = raycaster.intersectObject(groundMesh)
          if (hits.length > 0) {
            if (mode === 'wall') {
              wallMarker.position.lerp(hits[0].point, 0.4)
              wallMarker.rotation.y = cam.rotation.y
            } else {
              const pt = hits[0].point
              floorMarker.position.lerp(new THREE.Vector3(pt.x, 0.003, pt.z), 0.4)
              floorMarker.rotation.y = cam.rotation.y
              const t = Date.now() * 0.003
              const pulse = 0.9 + 0.2 * Math.sin(t)
              floorMarkerPlane.scale.set(pulse, pulse, pulse)
            }
          }
        }

        if (phase === 'wall-aim' && virtualWall && placedArt) {
          raycaster.setFromCamera(new THREE.Vector2(0, 0), cam)
          const hits = raycaster.intersectObject(virtualWall)
          if (hits.length > 0) {
            placedArt.position.lerp(hits[0].point, 0.4)
            placedArt.rotation.y = virtualWall.rotation.y
          }
        }

        if (phase === 'placed' && placedArt) {
          if (isDragging) {
            placedArt.position.lerp(dragTarget, dragLerpFactor)
          }

          if (dimElements && dimVisible) {
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

      const modeToggle = document.getElementById('mode-toggle')
      const modeBtns = modeToggle.querySelectorAll('.mode-btn')
      modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const newMode = btn.dataset.mode
          if (newMode === mode && phase === 'scanning') return
          modeBtns.forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
          startMode(newMode)
        })
      })

      const enableWhenReady = () => {
        if (modelLoaded) {
          tapEnabled = true
          modeToggle.style.display = 'flex'
          startMode('wall')
          console.log('Tap-to-place enabled')
        } else {
          showToast('Loading model...', 1500)
          setTimeout(enableWhenReady, 500)
        }
      }
      setTimeout(enableWhenReady, 1000)
    },
  }
}

const onxrloaded = () => {
  perfLog('xr-loaded-callback')
  XR8.XrController.configure({scale: 'absolute'})

  XR8.addCameraPipelineModules([
    XR8.GlTextureRenderer.pipelineModule(),
    XR8.Threejs.pipelineModule(),
    XR8.XrController.pipelineModule(),
    XRExtras.AlmostThere.pipelineModule(),
    XRExtras.FullWindowCanvas.pipelineModule(),
    XRExtras.Loading.pipelineModule(),
    XRExtras.RuntimeError.pipelineModule(),
    rugARScenePipelineModule(),
  ])

  XR8.run({canvas: document.getElementById('camerafeed')})
}

const startAR = () => {
  perfLog('ar-button-clicked')
  showARView()
  XRExtras.Loading.showLoading({onxrloaded})
}

const enableARButton = () => {
  const btn = document.getElementById('view-ar-btn')
  btn.disabled = false
  btn.classList.remove('loading')
  btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> View in AR'
}

const waitForARReady = () => {
  const check = () => {
    const xrReady = typeof XRExtras !== 'undefined'
    const xr8Ready = typeof XR8 !== 'undefined'
    if (!xrReady) perfLog('waiting-xrextras')
    if (!xr8Ready) perfLog('waiting-xr8')
    if (xrReady && xr8Ready) {
      perfLog('ar-scripts-ready')
      enableARButton()
      perfLog('button-enabled')
    } else {
      setTimeout(check, 100)
    }
  }
  check()
}

document.addEventListener('DOMContentLoaded', () => {
  perfLog('dom-content-loaded')
  const arBtn = document.getElementById('view-ar-btn')
  arBtn.disabled = true
  arBtn.classList.add('loading')
  arBtn.textContent = 'Loading AR...'
  arBtn.addEventListener('click', startAR)
  waitForARReady()
})
