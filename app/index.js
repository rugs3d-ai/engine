// Rugs3D - 8th Wall WebAR Test App
// Self-hosted 8th Wall engine for World Effects (SLAM tracking)
// Branding hidden via CSS

/* globals XR8 XRExtras THREE TWEEN */

// GLB model URL (Supabase)
const RUG_MODEL_URL = 'https://sewcrqgjitpwnfjxnkns.supabase.co/storage/v1/object/public/carpet-images/77de5373-12d7-4c05-97a5-6b12b076480e/models/carpet-3d-IMG_1878-mode2-1766757200493.glb'

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

// Show AR overlay and tap indicator when AR starts
const showOverlay = () => {
  document.getElementById('overlay').style.display = 'block'
  document.getElementById('tap-indicator').style.display = 'flex'
  const backBtn = document.getElementById('back-btn')
  document.body.appendChild(backBtn)
  backBtn.style.display = 'flex'
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
  // With Absolute Scale enabled, scale of 1 = real-world size from GLB model (in meters)
  const endScale = new THREE.Vector3(1, 1, 1)
  const animationMillis = 500

  const raycaster = new THREE.Raycaster()
  const tapPosition = new THREE.Vector2()
  
  THREE.ColorManagement.enabled = false

  let surface
  let placedRug = null
  let rugModelTemplate = null
  const loader = new THREE.GLTFLoader()
  
  // Gesture tracking for pinch zoom and rotation
  let currentScale = 1
  let currentRotation = 0
  let lastPinchDistance = 0
  let lastRotationAngle = 0
  let isPinching = false

  // Preload the GLB model
  const preloadModel = () => {
    return new Promise((resolve, reject) => {
      loader.load(
        RUG_MODEL_URL,
        (gltf) => {
          rugModelTemplate = gltf.scene
          // Configure meshes for proper rendering
          rugModelTemplate.traverse((child) => {
            if (child.isMesh) {
              // Disable shadows to avoid dark patches on rug
              child.castShadow = false
              child.receiveShadow = false
              // Make material double-sided for flat objects like rugs
              if (child.material) {
                child.material.side = THREE.DoubleSide
                // Ensure proper color rendering
                child.material.needsUpdate = true
              }
            }
          })
          console.log('Rug model preloaded successfully')
          resolve(gltf)
        },
        (progress) => {
          console.log('Loading model:', (progress.loaded / progress.total * 100).toFixed(0) + '%')
        },
        (error) => {
          console.error('Error loading rug model:', error)
          reject(error)
        }
      )
    })
  }

  const initXrScene = ({scene, camera, renderer}) => {
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // Use softer directional light from above
    const light = new THREE.DirectionalLight(0xffffff, 0.8)
    light.position.set(0, 10, 0)  // Directly above for even lighting
    light.castShadow = false  // Disable shadow casting
    scene.add(light)

    // Add hemisphere light for more natural, even lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1)
    hemiLight.position.set(0, 10, 0)
    scene.add(hemiLight)

    // Increase ambient light for better visibility
    scene.add(new THREE.AmbientLight(0xffffff, 0.8))

    surface = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100, 1, 1),
      new THREE.ShadowMaterial({
        opacity: 0.3,
      })
    )
    surface.rotateX(-Math.PI / 2)
    surface.position.set(0, 0, 0)
    surface.receiveShadow = true
    scene.add(surface)

    camera.position.set(0, 1.6, 0)
    
    // Preload the model
    preloadModel()
  }

  const createRugFromModel = () => {
    if (!rugModelTemplate) {
      console.warn('Model not loaded yet')
      return null
    }
    
    // Clone the preloaded model
    const rug = rugModelTemplate.clone()
    
    // Configure cloned meshes for proper rendering
    rug.traverse((child) => {
      if (child.isMesh) {
        // Disable shadows to avoid dark patches on rug
        child.castShadow = false
        child.receiveShadow = false
        // Make material double-sided for flat objects like rugs
        if (child.material) {
          child.material.side = THREE.DoubleSide
          child.material.needsUpdate = true
        }
      }
    })
    
    return rug
  }

  const animateIn = (rug, pointX, pointZ) => {
    const scale = {...startScale}

    rug.position.set(pointX, 0.01, pointZ)
    rug.scale.set(scale.x, scale.y, scale.z)
    
    XR8.Threejs.xrScene().scene.add(rug)

    new TWEEN.Tween(scale)
      .to(endScale, animationMillis)
      .easing(TWEEN.Easing.Elastic.Out)
      .onUpdate(() => {
        rug.scale.set(scale.x, scale.y, scale.z)
      })
      .start()
  }

  const placeRug = (pointX, pointZ) => {
    // If rug already exists, just move it (reposition)
    if (placedRug) {
      placedRug.position.set(pointX, 0.01, pointZ)
      return
    }
    
    // First time placing - create the rug
    const rug = createRugFromModel()
    if (rug) {
      placedRug = rug
      // Reset scale tracking when placing new rug
      currentScale = 1
      animateIn(placedRug, pointX, pointZ)
      // Hide tap indicator on first rug placement
      hideTapIndicator()
    } else {
      console.warn('Could not place rug - model not loaded')
    }
  }

  // Get distance between two touch points
  const getPinchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  // Get rotation angle between two touch points
  const getRotationAngle = (touches) => {
    const dx = touches[1].clientX - touches[0].clientX
    const dy = touches[1].clientY - touches[0].clientY
    return Math.atan2(dy, dx)
  }

  // Handle touch start - place rug or start gesture
  const touchStartHandler = (e) => {
    if (!tapEnabled) {
      return
    }

    // Prevent default browser behavior (scroll, zoom, etc.)
    e.preventDefault()

    // Two finger touch - start pinch zoom and rotation
    if (e.touches.length === 2 && placedRug) {
      isPinching = true
      lastPinchDistance = getPinchDistance(e.touches)
      lastRotationAngle = getRotationAngle(e.touches)
      return
    }

    // Single finger touch - tap to place/reposition rug
    if (e.touches.length === 1) {
      const {camera} = XR8.Threejs.xrScene()
      const touch = e.touches[0]
      const tapX = (touch.clientX / window.innerWidth) * 2 - 1
      const tapY = -(touch.clientY / window.innerHeight) * 2 + 1
      raycaster.setFromCamera(new THREE.Vector2(tapX, tapY), camera)
      const intersects = raycaster.intersectObject(surface)
      if (intersects.length > 0) {
        // Place or reposition rug at tap location
        placeRug(intersects[0].point.x, intersects[0].point.z)
      }
    }
  }

  // Handle touch move - pinch zoom and rotation
  const touchMoveHandler = (e) => {
    if (!tapEnabled || !placedRug) {
      return
    }

    e.preventDefault()

    // Handle two finger pinch zoom and rotation
    if (isPinching && e.touches.length === 2) {
      // Pinch zoom
      const newDistance = getPinchDistance(e.touches)
      const scaleFactor = newDistance / lastPinchDistance
      currentScale = Math.max(0.3, Math.min(3, currentScale * scaleFactor))
      placedRug.scale.set(currentScale, currentScale, currentScale)
      lastPinchDistance = newDistance

      // Two finger rotation
      const newAngle = getRotationAngle(e.touches)
      const angleDelta = newAngle - lastRotationAngle
      currentRotation += angleDelta
      placedRug.rotation.y = currentRotation
      lastRotationAngle = newAngle
    }
  }

  // Handle touch end - reset gesture states
  const touchEndHandler = (e) => {
    if (e.touches.length < 2) {
      isPinching = false
    }
  }

  return {
    name: 'rug-ar',

    onStart: ({canvas}) => {
      const {scene, camera, renderer} = XR8.Threejs.xrScene()

      initXrScene({scene, camera, renderer})

      // Touch event listeners for tap to place, drag rotate, and pinch zoom
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

      // Show AR overlay
      showOverlay()
      
      // Enable tap-to-place after a short delay to avoid capturing permission dialog taps
      setTimeout(() => {
        tapEnabled = true
        console.log('Tap-to-place enabled')
      }, 1000)
    },
  }
}

// Initialize when XR8 is loaded
const onxrloaded = () => {
  // Enable Absolute Scale - returns positions in meters for real-world sizing
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
    if (typeof XRExtras !== 'undefined' && typeof XR8 !== 'undefined') {
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

  document.getElementById('back-btn').addEventListener('click', () => {
    window.location.reload()
  })

  waitForARReady()
})
