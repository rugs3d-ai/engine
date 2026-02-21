/* globals AFRAME THREE */

const dbg = (msg) => {
  console.log('[DEBUG]', msg)
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

let arSceneInjected = false


AFRAME.registerComponent('grid-material', {
  schema: {type: {type: 'string', default: 'wall'}},
  init() {
    const isFloor = this.data.type === 'floor'
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')

    const fill = isFloor ? 'rgba(0, 180, 255, 0.3)' : 'rgba(121, 22, 255, 0.3)'
    const grid = isFloor ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.6)'
    const edge = isFloor ? 'rgba(0, 180, 255, 0.8)' : 'rgba(121, 22, 255, 0.8)'

    ctx.fillStyle = fill
    ctx.fillRect(0, 0, 256, 256)

    ctx.strokeStyle = grid
    ctx.lineWidth = 1.5
    const step = 32
    for (let i = 0; i <= 256; i += step) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, 256)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(256, i)
      ctx.stroke()
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(0, 256)
    ctx.lineTo(256, 256)
    ctx.stroke()

    ctx.strokeStyle = edge
    ctx.lineWidth = 3
    ctx.strokeRect(0, 0, 256, 256)

    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    const applyMat = () => {
      const mesh = this.el.getObject3D('mesh')
      if (mesh) { mesh.material = material }
    }
    applyMat()
    this.el.addEventListener('loaded', applyMat)
  },
})

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

AFRAME.registerComponent('ar-place', {
  init() {
    this.mode = 'wall'
    this.phase = 'waiting'
    this.raycaster = new THREE.Raycaster()
    this.cameraEl = null
    this.threeCamera = null
    this.wallEl = null
    this.dragging = false

    this.el.addEventListener('realityready', () => {
      this.cameraEl = document.getElementById('camera')
      this.threeCamera = this.cameraEl.getObject3D('camera')

      document.getElementById('mode-toggle').style.display = 'flex'
      this.startMode(this.mode)

      let touchStart = 0
      this.el.canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          touchStart = Date.now()
          if (this.phase === 'placed') this.dragging = true
        }
      })
      this.el.canvas.addEventListener('touchmove', (e) => {
        if (!this.dragging || e.touches.length !== 1) return
        const touch = e.touches[0]
        const x = (touch.clientX / window.innerWidth) * 2 - 1
        const y = -(touch.clientY / window.innerHeight) * 2 + 1
        this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.threeCamera)
        if (this.mode === 'wall' && this.wallEl) {
          const hits = this.raycaster.intersectObject(this.wallEl.object3D, true)
          if (hits.length > 0) {
            document.getElementById('placed-rug').object3D.position.lerp(hits[0].point, 0.5)
          }
        } else if (this.mode === 'floor') {
          const ground = document.getElementById('ground')
          if (!ground) return
          const hits = this.raycaster.intersectObject(ground.object3D, true)
          if (hits.length > 0) {
            const art = document.getElementById('placed-rug')
            const pt = hits[0].point
            art.object3D.position.lerp(new THREE.Vector3(pt.x, 0, pt.z), 0.5)
          }
        }
      })
      this.el.canvas.addEventListener('touchend', (e) => {
        this.dragging = false
        if (e.changedTouches.length === 1 && Date.now() - touchStart < 400) {
          this.handleTap()
        }
      })
    })
  },

  startMode(mode) {
    this.mode = mode
    this.phase = 'scanning'

    const art = document.getElementById('placed-rug')
    art.setAttribute('visible', 'false')
    art.object3D.position.set(0, -999, 0)
    art.setAttribute('scale', '1 1 1')
    art.removeAttribute('animation')

    const oldWall = document.getElementById('virtual-wall')
    if (oldWall) oldWall.parentNode.removeChild(oldWall)
    this.wallEl = null

    document.getElementById('wall-marker').setAttribute('visible', 'false')
    document.getElementById('floor-marker').setAttribute('visible', 'false')
    document.getElementById('crosshair').style.display = 'none'
    hideTapIndicator()

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode)
    })

    if (mode === 'wall') {
      document.getElementById('wall-marker').setAttribute('visible', 'true')
    } else {
      document.getElementById('floor-marker').setAttribute('visible', 'true')
    }

    dbg('Mode: ' + mode + ', scanning')
  },

  handleTap() {
    if (this.phase === 'scanning') {
      if (this.mode === 'wall') this.createWall()
      else this.placeOnFloor()
    } else if (this.phase === 'wall-aim') {
      this.lockArt()
    }
  },

  placeOnFloor() {
    const marker = document.getElementById('floor-marker')
    const art = document.getElementById('placed-rug')

    const mPos = marker.object3D.position
    art.object3D.position.set(mPos.x, 0, mPos.z)
    art.object3D.rotation.y = this.cameraEl.object3D.rotation.y
    art.setAttribute('visible', 'true')
    art.setAttribute('scale', '0.01 0.01 0.01')
    art.setAttribute('animation', 'property: scale; to: 1 1 1; dur: 400; easing: easeOutQuad')

    marker.setAttribute('visible', 'false')
    this.phase = 'placed'
    dbg('Floor: placed')
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

    this.phase = 'wall-aim'
    setTapText('Tap to place')
    showTapIndicator()
    document.getElementById('crosshair').style.display = 'block'
    dbg('Wall: aim at wall to position art')
  },

  lockArt() {
    this.phase = 'placed'
    hideTapIndicator()
    document.getElementById('crosshair').style.display = 'none'
    dbg('Wall: placed')
  },

  tick() {
    if (!this.threeCamera) {
      if (this.cameraEl) this.threeCamera = this.cameraEl.getObject3D('camera')
      return
    }

    if (this.phase === 'scanning') {
      this.raycaster.setFromCamera(new THREE.Vector2(0, -0.5), this.threeCamera)
      const ground = document.getElementById('ground')
      if (!ground) return
      const hits = this.raycaster.intersectObject(ground.object3D, true)
      if (hits.length > 0) {
        if (this.mode === 'wall') {
          const marker = document.getElementById('wall-marker')
          marker.object3D.position.lerp(hits[0].point, 0.4)
          marker.object3D.rotation.y = this.cameraEl.object3D.rotation.y
        } else {
          const marker = document.getElementById('floor-marker')
          const pt = hits[0].point
          marker.object3D.position.lerp(new THREE.Vector3(pt.x, 0.003, pt.z), 0.4)
          marker.object3D.rotation.y = this.cameraEl.object3D.rotation.y
        }
      }
    } else if (this.phase === 'wall-aim' && this.wallEl) {
      this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.threeCamera)
      const hits = this.raycaster.intersectObject(this.wallEl.object3D, true)
      if (hits.length > 0) {
        const art = document.getElementById('placed-rug')
        art.object3D.position.lerp(hits[0].point, 0.4)
        art.object3D.rotation.y = this.wallEl.object3D.rotation.y

        const screenPos = hits[0].point.clone().project(this.threeCamera)
        const tapEl = document.getElementById('tap-indicator')
        if (tapEl) {
          tapEl.style.left = ((screenPos.x * 0.5 + 0.5) * 100) + '%'
          tapEl.style.top = ((-screenPos.y * 0.5 + 0.5) * 100) + '%'
        }
      }
    }
  },
})

const showStartOverlay = () => {
  const overlay = document.getElementById('ar-start-overlay')
  if (overlay) overlay.style.display = 'flex'
}

const hideStartOverlay = () => {
  const overlay = document.getElementById('ar-start-overlay')
  if (overlay) overlay.style.display = 'none'
}

const injectArScene = () => {
  if (arSceneInjected) return
  arSceneInjected = true

  showStartOverlay()
  document.getElementById('preview-page').style.display = 'none'
  document.getElementById('back-btn').style.display = 'flex'

  const template = document.getElementById('ar-scene-template')
  const clone = template.content.cloneNode(true)
  document.getElementById('ar-container').appendChild(clone)

  const scene = document.getElementById('ar-scene')
  if (scene) {
    scene.addEventListener('realityready', hideStartOverlay, {once: true})
  }

  const startedAt = Date.now()
  const poll = setInterval(() => {
    const xrextrasUi =
      document.querySelector('#xrextras-loading') ||
      document.querySelector('.xrextras-loading') ||
      document.querySelector('[class*="xrextras-loading"]') ||
      document.querySelector('[id*="xrextras-loading"]') ||
      document.querySelector('[class*="xrextras"]')

    if (xrextrasUi) {
      hideStartOverlay()
      clearInterval(poll)
      return
    }

    if (Date.now() - startedAt > 8000) {
      hideStartOverlay()
      clearInterval(poll)
    }
  }, 100)
}

const startAR = () => {
  if (arSceneInjected) return
  injectArScene()
}

const initPage = () => {
  const btn = document.getElementById('view-ar-btn')
  btn.addEventListener('click', startAR)

  document.getElementById('back-btn').addEventListener('click', () => {
    window.location.reload()
  })

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const scene = document.getElementById('ar-scene')
      if (scene && scene.components['ar-place']) {
        scene.components['ar-place'].startMode(btn.dataset.mode)
      }
    })
  })

  const mv = document.getElementById('model-viewer')
  if (mv) {
    mv.addEventListener('error', (e) => { dbg('model-viewer ERROR: ' + (e.detail ? JSON.stringify(e.detail) : e.type)) })
    mv.addEventListener('load', () => { dbg('model-viewer loaded OK') })
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage)
} else {
  initPage()
}
