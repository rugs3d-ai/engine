// Rugs3D - 8th Wall WebAR (A-Frame)
// Self-hosted 8th Wall engine for World Effects (SLAM tracking)
// Migrated from Three.js to A-Frame
//
// The <a-scene> lives inside a <template> tag so it does NOT auto-initialize
// on page load. It is cloned into the DOM only when "View in AR" is clicked.
// Touch events are handled directly on the canvas (matching the original
// Three.js implementation) for reliable mobile tap/pinch/rotate.

/* globals AFRAME THREE */

let tapEnabled = false
let rugPlaced = false

const hideTapIndicator = () => {
  const tapIndicator = document.getElementById('tap-indicator')
  if (tapIndicator) {
    tapIndicator.classList.add('hidden')
    setTimeout(() => {
      tapIndicator.style.display = 'none'
    }, 300)
  }
}

const showTapIndicator = () => {
  document.getElementById('tap-indicator').style.display = 'flex'
}

AFRAME.registerComponent('configure-rug-material', {
  init() {
    this.el.addEventListener('model-loaded', () => {
      this.el.object3D.traverse((child) => {
        if (child.isMesh && child.material) {
          child.castShadow = false
          child.receiveShadow = false
          child.material.side = THREE.DoubleSide
          child.material.needsUpdate = true
        }
      })
    })
  },
})

AFRAME.registerComponent('tap-place-rug', {
  init() {
    const sceneEl = this.el
    const raycaster = new THREE.Raycaster()
    let placedRugObj = null
    let currentScale = 1
    let currentRotation = 0
    let lastPinchDistance = 0
    let lastRotationAngle = 0
    let isPinching = false
    let isDragging = false

    const getPinchDistance = (touches) => {
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const getRotationAngle = (touches) => {
      const dx = touches[1].clientX - touches[0].clientX
      const dy = touches[1].clientY - touches[0].clientY
      return Math.atan2(dy, dx)
    }

    const screenToNDC = (touch) => {
      const x = (touch.clientX / window.innerWidth) * 2 - 1
      const y = -(touch.clientY / window.innerHeight) * 2 + 1
      return new THREE.Vector2(x, y)
    }

    sceneEl.addEventListener('realityready', () => {
      showTapIndicator()
      setTimeout(() => {
        tapEnabled = true
      }, 1000)
    })

    sceneEl.addEventListener('loaded', () => {
      const ground = document.getElementById('ground')
      if (!ground) return

      const canvas = sceneEl.canvas

      canvas.addEventListener('touchstart', (e) => {
        if (!tapEnabled) return
        e.preventDefault()

        if (e.touches.length === 2 && placedRugObj) {
          isPinching = true
          isDragging = false
          lastPinchDistance = getPinchDistance(e.touches)
          lastRotationAngle = getRotationAngle(e.touches)
          return
        }

        if (e.touches.length === 1) {
          raycaster.setFromCamera(screenToNDC(e.touches[0]), sceneEl.camera)

          if (placedRugObj) {
            const rugHits = raycaster.intersectObject(placedRugObj, true)
            if (rugHits.length > 0) {
              isDragging = true
              return
            }
          }

          const groundHits = raycaster.intersectObject(ground.object3D, true)
          if (groundHits.length > 0) {
            const point = groundHits[0].point

            if (!rugPlaced) {
              const rug = document.createElement('a-entity')
              rug.setAttribute('id', 'placed-rug')
              rug.setAttribute('gltf-model', '#rugModel')
              rug.setAttribute('position', point.x + ' 0.01 ' + point.z)
              rug.setAttribute('scale', '0.01 0.01 0.01')
              rug.setAttribute('configure-rug-material', '')
              sceneEl.appendChild(rug)

              rug.addEventListener('model-loaded', () => {
                placedRugObj = rug.object3D
                currentScale = 1
                currentRotation = 0
                rug.setAttribute('animation', {
                  property: 'scale',
                  to: '1 1 1',
                  easing: 'easeOutQuad',
                  dur: 500,
                })
              })

              rugPlaced = true
              hideTapIndicator()
            } else {
              placedRugObj.position.set(point.x, 0.01, point.z)
            }
          }
        }
      }, true)

      canvas.addEventListener('touchmove', (e) => {
        if (!tapEnabled) return
        e.preventDefault()

        if (isDragging && e.touches.length === 1 && placedRugObj) {
          raycaster.setFromCamera(screenToNDC(e.touches[0]), sceneEl.camera)
          const groundHits = raycaster.intersectObject(ground.object3D, true)
          if (groundHits.length > 0) {
            placedRugObj.position.set(groundHits[0].point.x, 0.01, groundHits[0].point.z)
          }
          return
        }

        if (isPinching && e.touches.length === 2 && placedRugObj) {
          const newDistance = getPinchDistance(e.touches)
          const scaleFactor = newDistance / lastPinchDistance
          currentScale = Math.max(0.3, Math.min(3, currentScale * scaleFactor))
          placedRugObj.scale.set(currentScale, currentScale, currentScale)
          lastPinchDistance = newDistance

          const newAngle = getRotationAngle(e.touches)
          const angleDelta = newAngle - lastRotationAngle
          currentRotation += angleDelta
          placedRugObj.rotation.y = currentRotation
          lastRotationAngle = newAngle
        }
      }, {passive: false, capture: true})

      canvas.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
          isPinching = false
        }
        if (e.touches.length === 0) {
          isDragging = false
        }
      }, true)
    })
  },
})

const requestMotionPermission = async () => {
  if (typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const response = await DeviceMotionEvent.requestPermission()
      return response === 'granted'
    } catch (e) {
      return false
    }
  }
  return true
}

const startAR = async () => {
  await requestMotionPermission()

  document.getElementById('preview-page').style.display = 'none'
  document.getElementById('back-btn').style.display = 'flex'

  const template = document.getElementById('ar-scene-template')
  const clone = template.content.cloneNode(true)
  document.getElementById('ar-container').appendChild(clone)
}

window.onload = () => {
  document.getElementById('view-ar-btn').addEventListener('click', startAR)

  document.getElementById('back-btn').addEventListener('click', () => {
    window.location.reload()
  })
}
