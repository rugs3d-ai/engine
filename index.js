// Rugs3D - 8th Wall WebAR (A-Frame)
// Self-hosted 8th Wall engine for World Effects (SLAM tracking)
// Migrated from Three.js to A-Frame

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

    sceneEl.addEventListener('realityready', () => {
      showTapIndicator()
      document.getElementById('back-btn').style.display = 'flex'

      setTimeout(() => {
        tapEnabled = true
      }, 1000)
    })

    const ground = document.getElementById('ground')
    ground.addEventListener('click', (e) => {
      if (!tapEnabled) return

      const point = e.detail.intersection.point

      if (!rugPlaced) {
        const rug = document.createElement('a-entity')
        rug.setAttribute('id', 'placed-rug')
        rug.setAttribute('gltf-model', '#rugModel')
        rug.setAttribute('position', point.x + ' 0.01 ' + point.z)
        rug.setAttribute('scale', '0.01 0.01 0.01')
        rug.setAttribute('class', 'cantap')
        rug.setAttribute('shadow', 'receive: false; cast: false')
        rug.setAttribute('xrextras-hold-drag', '')
        rug.setAttribute('xrextras-two-finger-rotate', '')
        rug.setAttribute('xrextras-pinch-scale', 'min: 0.3; max: 3')
        rug.setAttribute('configure-rug-material', '')

        sceneEl.appendChild(rug)

        rug.addEventListener('model-loaded', () => {
          rug.setAttribute('visible', 'true')
          rug.setAttribute('animation', {
            property: 'scale',
            to: '1 1 1',
            easing: 'easeOutElastic',
            dur: 500,
          })
        })

        rugPlaced = true
        hideTapIndicator()
      } else {
        const rug = document.getElementById('placed-rug')
        if (rug) {
          rug.setAttribute('position', point.x + ' 0.01 ' + point.z)
        }
      }
    })
  },
})

const startAR = () => {
  document.getElementById('preview-page').style.display = 'none'
  document.getElementById('ar-scene').style.display = ''
}

window.onload = () => {
  document.getElementById('view-ar-btn').addEventListener('click', startAR)

  document.getElementById('back-btn').addEventListener('click', () => {
    window.location.reload()
  })
}
