/* globals AFRAME THREE */

let rugPlaced = false

const dbg = (msg) => {
  console.log('[DEBUG]', msg)
  let el = document.getElementById('debug-banner')
  if (!el) {
    el = document.createElement('div')
    el.id = 'debug-banner'
    el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,0.8);color:#0f0;font:12px monospace;padding:8px;z-index:99999;max-height:30vh;overflow:auto;'
    document.body.appendChild(el)
  }
  el.innerHTML += msg + '<br>'
  el.scrollTop = el.scrollHeight
}

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
      dbg('AR model loaded OK')
      const box = new THREE.Box3().setFromObject(this.el.object3D)
      const size = box.getSize(new THREE.Vector3())
      dbg('Model size: ' + size.x.toFixed(2) + ' x ' + size.y.toFixed(2) + ' x ' + size.z.toFixed(2))
      this.el.object3D.traverse((child) => {
        if (child.isMesh && child.material) {
          child.castShadow = false
          child.receiveShadow = false
          child.material.side = THREE.DoubleSide
          child.material.needsUpdate = true
        }
      })
    })
    this.el.addEventListener('model-error', (e) => {
      dbg('AR model FAILED: ' + JSON.stringify(e.detail))
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

      const camera = document.getElementById('camera')
      const camY = THREE.MathUtils.radToDeg(camera.object3D.rotation.y)

      dbg('Tap at: ' + point.x.toFixed(2) + ', ' + point.z.toFixed(2) + ' camY=' + camY.toFixed(1))

      if (!rugPlaced) {
        rug.setAttribute('scale', '0.01 0.01 0.01')
        rug.setAttribute('visible', 'true')
        rug.setAttribute('position', point.x + ' 1.5 ' + point.z)
        rug.setAttribute('rotation', '0 ' + camY + ' 0')
        dbg('Placed rug at y=1.5, visible=true')
        rug.setAttribute('animation', {
          property: 'scale',
          to: '1 1 1',
          easing: 'easeOutQuad',
          dur: 500,
        })
        rugPlaced = true
        hideTapIndicator()
      } else {
        rug.setAttribute('position', point.x + ' 1.5 ' + point.z)
        rug.setAttribute('rotation', '0 ' + camY + ' 0')
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

  const mv = document.getElementById('model-viewer')
  if (mv) {
    mv.addEventListener('error', (e) => { dbg('model-viewer ERROR: ' + (e.detail ? JSON.stringify(e.detail) : e.type)) })
    mv.addEventListener('load', () => { dbg('model-viewer loaded OK') })
    dbg('model-viewer src: ' + mv.getAttribute('src'))
  }
}
