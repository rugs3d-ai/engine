/* globals AFRAME THREE */

let rugPlaced = false

const hideTapIndicator = () => {
  const el = document.getElementById('tap-indicator')
  if (el) {
    el.classList.add('hidden')
    setTimeout(() => { el.style.display = 'none' }, 300)
  }
}

const showTapIndicator = () => {
  document.getElementById('tap-indicator').style.display = 'flex'
}

const enableARButton = () => {
  const btn = document.getElementById('view-ar-btn')
  btn.disabled = false
  btn.querySelector('.spinner').style.display = 'none'
  btn.querySelector('.ar-icon').style.display = 'block'
  document.getElementById('btn-text').textContent = 'View in AR'
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
    })

    const ground = document.getElementById('ground')
    if (!ground) return

    ground.addEventListener('click', (e) => {
      if (!e.detail || !e.detail.intersection) return

      const point = e.detail.intersection.point
      const rug = document.getElementById('placed-rug')
      if (!rug) return

      if (!rugPlaced) {
        rug.setAttribute('scale', '0.01 0.01 0.01')
        rug.setAttribute('visible', 'true')
        rug.setAttribute('position', point.x + ' 0.01 ' + point.z)
        rug.setAttribute('animation', {
          property: 'scale',
          to: '1 1 1',
          easing: 'easeOutQuad',
          dur: 500,
        })
        rugPlaced = true
        hideTapIndicator()
      } else {
        rug.setAttribute('position', point.x + ' 0.01 ' + point.z)
      }
    })
  },
})

const startAR = () => {
  document.getElementById('preview-page').style.display = 'none'
  document.getElementById('back-btn').style.display = 'flex'

  const template = document.getElementById('ar-scene-template')
  const clone = template.content.cloneNode(true)
  document.getElementById('ar-container').appendChild(clone)
}

window.onload = () => {
  const btn = document.getElementById('view-ar-btn')
  btn.addEventListener('click', startAR)

  const onxrloaded = () => { enableARButton() }
  window.XR8 ? onxrloaded() : window.addEventListener('xrloaded', onxrloaded)

  document.getElementById('back-btn').addEventListener('click', () => {
    window.location.reload()
  })
}
