// Rugs3D - 8th Wall WebAR Test App
// Self-hosted 8th Wall engine for World Effects (SLAM tracking)
// Branding hidden via CSS

/* globals XR8 XRExtras CoachingOverlay THREE TWEEN */

// GLB model URL (Supabase)
const RUG_MODEL_URL = 'https://dfcksvowcprcrpkpfptk.supabase.co/storage/v1/object/public/3d-models/models/2A0pQDoKVq/carpet_model_20260210_094217.glb'

// Track if AR has been started
let arStarted = false
// Track if rug has been placed (to prevent hiding tap indicator on permission taps)
let rugPlaced = false
// Track if tap-to-place is enabled (delay to avoid permission dialog taps)
let tapEnabled = false

// Show preview page, hide AR view
const showPreview = () => {
  document.getElementById('preview-page').style.display = 'flex'
  document.getElementById('ar-view').style.display = 'none'
  
  // Stop AR if it was running
  if (arStarted) {
    try {
      XR8.stop()
      arStarted = false
    } catch (e) {
      console.log('AR stop error:', e)
    }
  }
}

// Show AR view, hide preview page
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

// Show AR overlay and tap indicator when AR starts
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

// Hide tap indicator when rug is placed
const hideTapIndicator = () => {
  const tapIndicator = document.getElementById('tap-indicator')
  if (tapIndicator) {
    tapIndicator.classList.add('hidden')
    setTimeout(() => {
      tapIndicator.style.display = 'none'
    }, 300)
  }
}

const rugARScenePipelineModule = () => {
  const startScale = new THREE.Vector3(0.01, 0.01, 0.01)
  const endScale = new THREE.Vector3(1, 1, 1)
  const animationMillis = 500

  THREE.ColorManagement.enabled = false

  let placedArt = null
  let artModelTemplate = null
  const loader = new THREE.GLTFLoader()

  let currentScale = 1
  let lastPinchDistance = 0
  let isPinching = false

  // Preload the GLB model
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

  const animateIn = (art, position, rotation) => {
    const scale = {...startScale}

    art.position.set(position.x, position.y, position.z)
    if (rotation) {
      art.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
    }
    art.scale.set(scale.x, scale.y, scale.z)

    XR8.Threejs.xrScene().scene.add(art)

    new TWEEN.Tween(scale)
      .to(endScale, animationMillis)
      .easing(TWEEN.Easing.Elastic.Out)
      .onUpdate(() => {
        art.scale.set(scale.x, scale.y, scale.z)
      })
      .start()
  }

  const placeArt = (position, rotation) => {
    if (placedArt) {
      placedArt.position.set(position.x, position.y, position.z)
      if (rotation) {
        placedArt.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      }
      return
    }

    const art = createArtFromModel()
    if (art) {
      placedArt = art
      currentScale = 1
      animateIn(placedArt, position, rotation)
      hideTapIndicator()
    } else {
      console.warn('Could not place art - model not loaded')
    }
  }

  const getPinchDistance= (touches) => {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const touchStartHandler= (e) => {
    if (!tapEnabled) {
      return
    }

    e.preventDefault()

    if (e.touches.length === 2 && placedArt) {
      isPinching = true
      lastPinchDistance = getPinchDistance(e.touches)
      return
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0]
      const x = touch.clientX / window.innerWidth
      const y = touch.clientY / window.innerHeight
      const hitTestResults = XR8.XrController.hitTest(x, y, ['FEATURE_POINT'])
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0]
        placeArt(hit.position, hit.rotation)
      }
    }
  }

  const touchMoveHandler = (e) => {
    if (!tapEnabled || !placedArt) {
      return
    }

    e.preventDefault()

    if (isPinching && e.touches.length === 2) {
      const newDistance = getPinchDistance(e.touches)
      const scaleFactor = newDistance / lastPinchDistance
      currentScale = Math.max(0.3, Math.min(3, currentScale * scaleFactor))
      placedArt.scale.set(currentScale, currentScale, currentScale)
      lastPinchDistance = newDistance
    }
  }

  const touchEndHandler = (e) => {
    if (e.touches.length < 2) {
      isPinching = false
    }
  }

  let coachingComplete = false

  return {
    name: 'rug-ar',

    onStart: ({canvas}) => {
      const {scene, camera, renderer} = XR8.Threejs.xrScene()

      initXrScene({scene, camera, renderer})

      canvas.addEventListener('touchstart', touchStartHandler, true)
      canvas.addEventListener('touchmove', touchMoveHandler, {passive: false, capture: true})
      canvas.addEventListener('touchend', touchEndHandler, true)

      const animate = (time) => {
        requestAnimationFrame(animate)
        TWEEN.update(time)
      }
      animate()

      XR8.XrController.updateCameraProjectionMatrix({
        origin: camera.position,
        facing: camera.quaternion,
      })

      showOverlay()
    },

    onUpdate: ({processCpuResult}) => {
      if (!coachingComplete && processCpuResult.reality && processCpuResult.reality.trackingStatus === 'NORMAL') {
        coachingComplete = true
        tapEnabled = true
        showTapIndicator()
        console.log('Coaching complete - tap-to-place enabled')
      }
    },
  }
}

// Initialize when XR8 is loaded
const onxrloaded = () => {
  XR8.XrController.configure({scale: 'absolute'})

  CoachingOverlay.configure({
    animationColor: '#ffffff',
    promptText: 'Move your phone slowly to detect surfaces',
  })

  XR8.addCameraPipelineModules([
    XR8.GlTextureRenderer.pipelineModule(),
    XR8.Threejs.pipelineModule(),
    XR8.XrController.pipelineModule(),
    XRExtras.AlmostThere.pipelineModule(),
    XRExtras.FullWindowCanvas.pipelineModule(),
    XRExtras.Loading.pipelineModule(),
    XRExtras.RuntimeError.pipelineModule(),
    CoachingOverlay.pipelineModule(),
    rugARScenePipelineModule(),
  ])

  // Start the AR experience
  XR8.run({canvas: document.getElementById('camerafeed')})
}

// Start AR experience when button is clicked
const startAR = () => {
  showARView()
  XRExtras.Loading.showLoading({onxrloaded})
}

const enableARButton = () => {
  const btn = document.getElementById('view-ar-btn')
  btn.disabled = false
  btn.classList.remove('loading')
}

const waitForARReady = () => {
  const check = () => {
    if (typeof XRExtras !== 'undefined' && typeof XR8 !== 'undefined' && typeof CoachingOverlay !== 'undefined') {
      enableARButton()
    } else {
      setTimeout(check, 200)
    }
  }
  check()
}

document.addEventListener('DOMContentLoaded', () => {
  const arBtn = document.getElementById('view-ar-btn')
  arBtn.disabled = true
  arBtn.classList.add('loading')

  arBtn.addEventListener('click', startAR)

  waitForARReady()
})
