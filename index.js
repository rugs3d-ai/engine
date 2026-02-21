/* globals AFRAME THREE */

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

const setTapText = (text) => {
  const el = document.querySelector('#tap-indicator .tap-text')
  if (el) el.textContent = text
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

AFRAME.registerComponent('wall-place', {
  init() {
    this.phase = 'waiting'
    this.raycaster = new THREE.Raycaster()
    this.cameraEl = null
    this.threeCamera = null
    this.wallEl = null

    this.el.addEventListener('realityready', () => {
      this.cameraEl = document.getElementById('camera')
      this.threeCamera = this.cameraEl.getObject3D('camera')
      this.phase = 'floor'
      setTapText('Tap the base of the wall')
      showTapIndicator()
      document.getElementById('wall-marker').setAttribute('visible', 'true')
      dbg('Phase: floor - point at wall base')
    })

    this.el.addEventListener('click', () => {
      if (this.phase === 'floor') {
        this.createWall()
      } else if (this.phase === 'wall') {
        this.lockArt()
      }
    })
  },

  createWall() {
    const marker = document.getElementById('wall-marker')
    const art = document.getElementById('placed-rug')

    const wall = document.createElement('a-box')
    wall.setAttribute('id', 'virtual-wall')
    wall.setAttribute('class', 'cantap')
    wall.setAttribute('material', 'color: white; transparent: true; opacity: 0')
    this.el.appendChild(wall)

    wall.object3D.scale.set(100, 100, 0.25)
    wall.object3D.rotation.y = marker.object3D.rotation.y
    const mPos = marker.object3D.position
    wall.object3D.position.set(mPos.x, mPos.y + 50, mPos.z)

    this.wallEl = wall

    marker.setAttribute('visible', 'false')
    art.setAttribute('visible', 'true')
    art.setAttribute('scale', '1 1 1')

    this.phase = 'wall'
    setTapText('Tap to place on wall')
    document.getElementById('crosshair').style.display = 'block'
    dbg('Phase: wall - aim at wall to position art')
  },

  lockArt() {
    this.phase = 'placed'
    hideTapIndicator()
    document.getElementById('crosshair').style.display = 'none'
    dbg('Phase: placed - art locked, gestures active')
  },

  tick() {
    if (!this.threeCamera) {
      if (this.cameraEl) this.threeCamera = this.cameraEl.getObject3D('camera')
      return
    }

    if (this.phase === 'floor') {
      this.raycaster.setFromCamera(new THREE.Vector2(0, -0.5), this.threeCamera)
      const ground = document.getElementById('ground')
      if (!ground) return
      const hits = this.raycaster.intersectObject(ground.object3D, true)
      if (hits.length > 0) {
        const marker = document.getElementById('wall-marker')
        marker.object3D.position.lerp(hits[0].point, 0.4)
        marker.object3D.rotation.y = this.cameraEl.object3D.rotation.y
      }
    } else if (this.phase === 'wall' && this.wallEl) {
      this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.threeCamera)
      const hits = this.raycaster.intersectObject(this.wallEl.object3D, true)
      if (hits.length > 0) {
        const art = document.getElementById('placed-rug')
        art.object3D.position.lerp(hits[0].point, 0.4)
        art.object3D.rotation.y = this.wallEl.object3D.rotation.y
      }
    }
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
  }
}
