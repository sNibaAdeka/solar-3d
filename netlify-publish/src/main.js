"use strict";

if (!window.THREE) {
  document.body.classList.add("runtime-error");
  const rootNode = document.querySelector("#scene-root");
  if (rootNode) {
    rootNode.innerHTML =
      '<div class="load-error"><strong>3D engine did not load.</strong><span>Check your internet connection or open this page through the local server.</span></div>';
  }
  throw new Error("THREE failed to load");
}

const root = document.querySelector("#scene-root");
const pauseButton = document.querySelector("#pauseButton");
const resetButton = document.querySelector("#resetButton");
const speedSlider = document.querySelector("#speedSlider");
const speedValue = document.querySelector("#speedValue");
const speedReadout = document.querySelector("#speedReadout");
const labelsToggle = document.querySelector("#labelsToggle");
const orbitsToggle = document.querySelector("#orbitsToggle");
const followToggle = document.querySelector("#followToggle");
const planetList = document.querySelector("#planetList");
const statusText = document.querySelector("#statusText");
const targetReadout = document.querySelector("#targetReadout");

const infoType = document.querySelector("#infoType");
const infoName = document.querySelector("#infoName");
const infoSummary = document.querySelector("#infoSummary");
const factDiameter = document.querySelector("#factDiameter");
const factDay = document.querySelector("#factDay");
const factYear = document.querySelector("#factYear");
const factMoons = document.querySelector("#factMoons");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010309);
scene.fog = new THREE.FogExp2(0x010309, 0.0035);

const camera = new THREE.PerspectiveCamera(54, root.clientWidth / root.clientHeight, 0.03, 900);
camera.position.set(0, 58, 78);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(root.clientWidth, root.clientHeight);
if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
} else {
  renderer.outputEncoding = THREE.sRGBEncoding;
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
root.appendChild(renderer.domElement);

const labelRenderer = new THREE.CSS2DRenderer();
labelRenderer.setSize(root.clientWidth, root.clientHeight);
labelRenderer.domElement.className = "label-layer";
root.appendChild(labelRenderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 0.72;
controls.maxDistance = 240;
controls.target.set(0, 0, 0);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
const clickables = [];
const bodies = [];
const planets = [];
const orbitLines = [];
const labelObjects = [];
const temporaryVectors = {
  world: new THREE.Vector3(),
  direction: new THREE.Vector3(),
  matrixPosition: new THREE.Vector3()
};

let simulationSpeed = Number(speedSlider.value);
let isPaused = false;
let selectedBody = null;
let flyTo = null;

const sunInfo = {
  name: "Sun",
  type: "Star",
  diameter: "1.39 million km",
  day: "25 Earth days",
  year: "System center",
  moons: "Planets orbit it",
  summary:
    "The center of this system. Its animated glow lights every planet, moon, ring, and asteroid."
};

const initialOrbitPhases = {
  Mercury: -0.45,
  Venus: 2.75,
  Earth: 3.48,
  Mars: 4.34,
  Jupiter: 3.58,
  Saturn: 1.02,
  Uranus: 0.78,
  Neptune: 2.4
};

const planetData = [
  {
    name: "Mercury",
    radius: 0.48,
    distance: 7.0,
    orbitSpeed: 0.62,
    rotationSpeed: 0.45,
    tilt: 0.01,
    type: "Rocky planet",
    colors: ["#8f8274", "#d1b596", "#4c443f"],
    texture: "rocky",
    diameter: "4,879 km",
    day: "58.6 days",
    year: "88 days",
    moons: "0",
    summary: "A cratered inner world racing around the Sun in the tightest orbit."
  },
  {
    name: "Venus",
    radius: 0.9,
    distance: 9.7,
    orbitSpeed: 0.49,
    rotationSpeed: -0.18,
    tilt: 3.09,
    type: "Rocky planet",
    colors: ["#d7a85e", "#fff1b4", "#8f6235"],
    texture: "cloudy",
    diameter: "12,104 km",
    day: "243 days",
    year: "225 days",
    moons: "0",
    summary: "A bright cloud-wrapped planet with slow retrograde rotation."
  },
  {
    name: "Earth",
    radius: 0.95,
    distance: 12.5,
    orbitSpeed: 0.4,
    rotationSpeed: 0.86,
    tilt: 0.41,
    type: "Ocean planet",
    colors: ["#2a78b8", "#52a35d", "#f3e4b2"],
    texture: "earth",
    diameter: "12,742 km",
    day: "24 hours",
    year: "365 days",
    moons: "1",
    summary: "Blue oceans, green continents, drifting clouds, and one large moon.",
    moonsData: [
      {
        name: "Moon",
        radius: 0.25,
        distance: 1.66,
        orbitSpeed: 1.25,
        rotationSpeed: 0.3,
        color: "#c9c7be",
        diameter: "3,475 km",
        summary: "Earth's large natural satellite stabilizes tides and axial wobble."
      }
    ]
  },
  {
    name: "Mars",
    radius: 0.58,
    distance: 15.8,
    orbitSpeed: 0.32,
    rotationSpeed: 0.82,
    tilt: 0.44,
    type: "Rocky planet",
    colors: ["#bd573a", "#f29b6d", "#64281d"],
    texture: "mars",
    diameter: "6,779 km",
    day: "24.6 hours",
    year: "687 days",
    moons: "2",
    summary: "A dusty red planet with polar caps, volcanoes, canyons, and two tiny moons.",
    moonsData: [
      {
        name: "Phobos",
        radius: 0.075,
        distance: 0.92,
        orbitSpeed: 2.2,
        rotationSpeed: 0.2,
        color: "#8b7d72",
        diameter: "22 km",
        summary: "Mars' larger inner moon moves fast across the Martian sky."
      },
      {
        name: "Deimos",
        radius: 0.06,
        distance: 1.16,
        orbitSpeed: 1.42,
        rotationSpeed: 0.2,
        color: "#aaa096",
        diameter: "12 km",
        summary: "A small, distant Martian moon with a dark rocky surface."
      }
    ]
  },
  {
    name: "Jupiter",
    radius: 3.25,
    distance: 23.3,
    orbitSpeed: 0.16,
    rotationSpeed: 1.55,
    tilt: 0.05,
    type: "Gas giant",
    colors: ["#c98955", "#f1d2a4", "#6f4934"],
    texture: "jupiter",
    diameter: "139,820 km",
    day: "9.9 hours",
    year: "11.9 years",
    moons: "95+",
    summary: "The largest planet, wrapped in fast bands and a long-lived storm system.",
    moonsData: [
      {
        name: "Io",
        radius: 0.22,
        distance: 4.16,
        orbitSpeed: 1.7,
        rotationSpeed: 0.25,
        color: "#d9b94d",
        diameter: "3,643 km",
        summary: "A volcanic moon colored by sulfur-rich plains."
      },
      {
        name: "Europa",
        radius: 0.2,
        distance: 4.78,
        orbitSpeed: 1.28,
        rotationSpeed: 0.22,
        color: "#d8d0bd",
        diameter: "3,122 km",
        summary: "An icy moon with a hidden ocean beneath cracked crust."
      },
      {
        name: "Ganymede",
        radius: 0.28,
        distance: 5.48,
        orbitSpeed: 0.96,
        rotationSpeed: 0.2,
        color: "#9a8c7b",
        diameter: "5,268 km",
        summary: "The largest moon in the solar system, bigger than Mercury."
      },
      {
        name: "Callisto",
        radius: 0.26,
        distance: 6.16,
        orbitSpeed: 0.72,
        rotationSpeed: 0.18,
        color: "#6f6a62",
        diameter: "4,821 km",
        summary: "A heavily cratered outer Galilean moon."
      }
    ]
  },
  {
    name: "Saturn",
    radius: 2.95,
    distance: 31.2,
    orbitSpeed: 0.118,
    rotationSpeed: 1.42,
    tilt: 0.47,
    type: "Ringed giant",
    colors: ["#dbc58e", "#f8e7b9", "#8e774c"],
    texture: "saturn",
    ring: { inner: 1.65, outer: 2.62, color: "#ead6a2" },
    diameter: "116,460 km",
    day: "10.7 hours",
    year: "29.5 years",
    moons: "146+",
    summary: "A pale gas giant surrounded by broad animated rings and icy moons.",
    moonsData: [
      {
        name: "Titan",
        radius: 0.29,
        distance: 5.58,
        orbitSpeed: 0.7,
        rotationSpeed: 0.18,
        color: "#d79f53",
        diameter: "5,150 km",
        summary: "Saturn's largest moon has a thick atmosphere and methane lakes."
      },
      {
        name: "Enceladus",
        radius: 0.12,
        distance: 4.58,
        orbitSpeed: 1.06,
        rotationSpeed: 0.2,
        color: "#eef3f3",
        diameter: "504 km",
        summary: "A bright icy moon known for water-rich geysers."
      }
    ]
  },
  {
    name: "Uranus",
    radius: 1.9,
    distance: 39.1,
    orbitSpeed: 0.082,
    rotationSpeed: -0.96,
    tilt: 1.71,
    type: "Ice giant",
    colors: ["#8bd6d5", "#d1ffff", "#3b8793"],
    texture: "ice",
    ring: { inner: 1.3, outer: 1.75, color: "#a4e5df", opacity: 0.42 },
    diameter: "50,724 km",
    day: "17.2 hours",
    year: "84 years",
    moons: "27",
    summary: "A blue-green ice giant tilted almost sideways as it orbits the Sun.",
    moonsData: [
      {
        name: "Titania",
        radius: 0.18,
        distance: 2.95,
        orbitSpeed: 0.72,
        rotationSpeed: 0.16,
        color: "#a79e9a",
        diameter: "1,578 km",
        summary: "The largest Uranian moon, with icy cliffs and old cratered terrain."
      },
      {
        name: "Oberon",
        radius: 0.17,
        distance: 3.52,
        orbitSpeed: 0.54,
        rotationSpeed: 0.15,
        color: "#7f7975",
        diameter: "1,523 km",
        summary: "A dark, icy outer moon of Uranus."
      }
    ]
  },
  {
    name: "Neptune",
    radius: 1.86,
    distance: 45.6,
    orbitSpeed: 0.064,
    rotationSpeed: 1.05,
    tilt: 0.49,
    type: "Ice giant",
    colors: ["#2f64d7", "#7ab8ff", "#133a87"],
    texture: "neptune",
    diameter: "49,244 km",
    day: "16.1 hours",
    year: "165 years",
    moons: "14",
    summary: "A deep-blue planet with high winds, subtle storms, and Triton in orbit.",
    moonsData: [
      {
        name: "Triton",
        radius: 0.2,
        distance: 3.05,
        orbitSpeed: -0.8,
        rotationSpeed: 0.16,
        color: "#d6d9cf",
        diameter: "2,707 km",
        summary: "Neptune's largest moon orbits backward relative to Neptune's rotation."
      }
    ]
  }
];

const textureCache = new Map();
const bodyGeometry = new THREE.SphereGeometry(1, 96, 64);
const moonGeometry = new THREE.SphereGeometry(1, 48, 30);

const solarGroup = new THREE.Group();
scene.add(solarGroup);

const selectionMarker = createSelectionMarker();
scene.add(selectionMarker);

const ambientLight = new THREE.HemisphereLight(0x8ebcff, 0x24110b, 0.68);
scene.add(ambientLight);

const rimLight = new THREE.DirectionalLight(0x7fd8ff, 0.38);
rimLight.position.set(-35, 24, -42);
scene.add(rimLight);

const sunLight = new THREE.PointLight(0xffd49a, 8.4, 230, 1.35);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 0.4;
sunLight.shadow.camera.far = 90;
scene.add(sunLight);

createStarfield();
createNebulaBackdrop();
createGalaxyDust();
const sunBody = createSun();
const asteroidBelt = createAsteroidBelt();
const comet = createComet();
createPlanets();
createPlanetButtons();
selectBody(sunBody);
animate();

function createSun() {
  const sunTexture = makeSunTexture();
  const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture, color: 0xffd56a });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(3.18, 128, 80), sunMaterial);
  sun.name = "Sun";
  sun.userData.info = sunInfo;
  solarGroup.add(sun);

  const glowTexture = makeGlowTexture("#ffc65c", "#f26f4f");
  const corona = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffd06d,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  corona.scale.set(13, 13, 1);
  solarGroup.add(corona);

  const wideGlow = corona.clone();
  wideGlow.material = corona.material.clone();
  wideGlow.material.opacity = 0.22;
  wideGlow.scale.set(26, 26, 1);
  solarGroup.add(wideGlow);

  const flareGroup = new THREE.Group();
  const flareTexture = makeGlowTexture("#ffe8a6", "#ff6f3d");
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2;
    const flare = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flareTexture,
        color: i % 2 ? 0xffa64d : 0xffe08a,
        transparent: true,
        opacity: 0.18 + (i % 3) * 0.045,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    flare.position.set(Math.cos(angle) * 3.15, Math.sin(angle * 1.7) * 0.55, Math.sin(angle) * 3.15);
    flare.scale.set(2.5 + (i % 4) * 0.55, 2.5 + (i % 4) * 0.55, 1);
    flareGroup.add(flare);
  }
  solarGroup.add(flareGroup);

  const label = makeLabel("Sun");
  label.position.set(0, 4.1, 0);
  sun.add(label);
  labelObjects.push(label);

  const body = {
    name: "Sun",
    type: "Star",
    root: sun,
    mesh: sun,
    radius: 3.18,
    info: sunInfo,
    update(delta, elapsed) {
      sun.rotation.y += delta * 0.12 * simulationSpeed;
      corona.material.rotation += delta * 0.09 * simulationSpeed;
      wideGlow.material.rotation -= delta * 0.045 * simulationSpeed;
      flareGroup.rotation.y += delta * 0.18 * simulationSpeed;
      flareGroup.rotation.z += delta * 0.025 * simulationSpeed;
      const pulse = 1 + Math.sin(elapsed * 1.15) * 0.035;
      sunLight.intensity = 8.2 * pulse;
      corona.scale.setScalar(13 * pulse);
      wideGlow.scale.setScalar(26 * (1 + Math.sin(elapsed * 0.65) * 0.025));
    }
  };

  sun.userData.body = body;
  clickables.push(sun);
  bodies.push(body);
  return body;
}

function createPlanets() {
  planetData.forEach((data, index) => {
    const orbit = new THREE.Group();
    orbit.rotation.y =
      initialOrbitPhases[data.name] ?? (index / planetData.length) * Math.PI * 2 + (index % 2 ? 0.35 : -0.2);
    orbit.rotation.z = THREE.MathUtils.degToRad((index % 2 === 0 ? 1 : -1) * (index + 1) * 0.32);
    solarGroup.add(orbit);

    const orbitPath = createOrbitPath(data.distance, orbit.rotation.z, data.name);
    orbitLines.push(orbitPath);
    scene.add(orbitPath);

    const planetRoot = new THREE.Group();
    planetRoot.position.x = data.distance;
    orbit.add(planetRoot);

    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.z = data.tilt;
    planetRoot.add(tiltGroup);

    const planetTexture = makePlanetTexture(data);
    const planetMaterial = createPlanetMaterial(data, planetTexture);

    const planetMesh = new THREE.Mesh(bodyGeometry, planetMaterial);
    planetMesh.scale.setScalar(data.radius);
    planetMesh.castShadow = true;
    planetMesh.receiveShadow = true;
    tiltGroup.add(planetMesh);

    if (data.name === "Earth") {
      const cloudLayer = new THREE.Mesh(
        bodyGeometry,
        new THREE.MeshStandardMaterial({
          map: makeCloudTexture(),
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
          roughness: 1
        })
      );
      cloudLayer.scale.setScalar(data.radius * 1.018);
      tiltGroup.add(cloudLayer);
      planetRoot.userData.cloudLayer = cloudLayer;
    }

    if (data.texture === "cloudy") {
      const cloudLayer = new THREE.Mesh(
        bodyGeometry,
        new THREE.MeshStandardMaterial({
          map: makeCloudTexture(612),
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          roughness: 1
        })
      );
      cloudLayer.scale.setScalar(data.radius * 1.025);
      tiltGroup.add(cloudLayer);
      planetRoot.userData.cloudLayer = cloudLayer;
    }

    const atmosphere = createAtmosphere(data);
    if (atmosphere) {
      tiltGroup.add(atmosphere);
      planetRoot.userData.atmosphere = atmosphere;
    }

    const halo = createPlanetHalo(data);
    planetRoot.add(halo);
    planetRoot.userData.halo = halo;

    if (data.ring) {
      const ring = createPlanetRing(data);
      ring.rotation.x = Math.PI / 2;
      tiltGroup.add(ring);
      planetRoot.userData.ring = ring;
    }

    const label = makeLabel(data.name);
    label.position.set(0, data.radius + 0.55, 0);
    planetRoot.add(label);
    labelObjects.push(label);

    const moons = createMoons(data, planetRoot);

    const body = {
      name: data.name,
      type: data.type,
      data,
      root: planetRoot,
      mesh: planetMesh,
      orbit,
      tiltGroup,
      radius: data.radius,
      moons,
      info: data,
      update(delta) {
        orbit.rotation.y += delta * data.orbitSpeed * simulationSpeed;
        tiltGroup.rotation.y += delta * data.rotationSpeed * simulationSpeed;
        if (planetRoot.userData.cloudLayer) {
          planetRoot.userData.cloudLayer.rotation.y += delta * 0.26 * simulationSpeed;
        }
        if (planetRoot.userData.ring) {
          planetRoot.userData.ring.rotation.z += delta * 0.018 * simulationSpeed;
        }
        if (planetRoot.userData.halo) {
          planetRoot.userData.halo.material.rotation += delta * 0.035 * simulationSpeed;
          planetRoot.userData.halo.lookAt(camera.position);
        }
      }
    };

    planetMesh.userData.body = body;
    planetRoot.userData.body = body;
    clickables.push(planetMesh);
    planets.push(body);
    bodies.push(body);
  });
}

function createMoons(data, planetRoot) {
  const moons = [];
  (data.moonsData || []).forEach((moonData, moonIndex) => {
    const moonPivot = new THREE.Group();
    moonPivot.rotation.z = THREE.MathUtils.degToRad((moonIndex + 1) * 3.2);
    planetRoot.add(moonPivot);

    const moonTexture = makeMoonTexture(moonData.color, 200 + moonIndex + data.name.length);
    const moon = new THREE.Mesh(
      moonGeometry,
      new THREE.MeshStandardMaterial({
        map: moonTexture,
        bumpMap: moonTexture,
        bumpScale: 0.035,
        roughness: 0.9
      })
    );
    moon.scale.setScalar(moonData.radius);
    moon.position.x = moonData.distance;
    moon.castShadow = true;
    moon.receiveShadow = true;
    moonPivot.add(moon);

    const moonPath = createMoonPath(moonData.distance);
    moonPivot.add(moonPath);
    orbitLines.push(moonPath);

    const label = makeLabel(moonData.name, true);
    label.position.set(0, moonData.radius + 0.18, 0);
    moon.add(label);
    labelObjects.push(label);

    const info = {
      name: moonData.name,
      type: "Moon",
      diameter: moonData.diameter,
      day: "Tidally locked",
      year: `Orbits ${data.name}`,
      moons: "0",
      summary: moonData.summary
    };

    const moonBody = {
      name: moonData.name,
      type: "Moon",
      root: moon,
      mesh: moon,
      radius: moonData.radius,
      info,
      update(delta) {
        moonPivot.rotation.y += delta * moonData.orbitSpeed * simulationSpeed;
        moon.rotation.y += delta * moonData.rotationSpeed * simulationSpeed;
      }
    };

    moon.userData.body = moonBody;
    clickables.push(moon);
    bodies.push(moonBody);
    moons.push(moonBody);
  });
  return moons;
}

function createPlanetMaterial(data, texture) {
  const isGas = ["jupiter", "saturn", "ice", "neptune"].includes(data.texture);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    bumpMap: isGas ? null : texture,
    bumpScale: data.texture === "rocky" || data.texture === "mars" ? 0.055 : 0.018,
    roughness: data.texture === "ice" || data.texture === "neptune" ? 0.68 : 0.86,
    metalness: 0.0
  });

  material.emissive = new THREE.Color(data.colors[0]);
  material.emissive.multiplyScalar(isGas ? 0.018 : 0.012);
  material.emissiveIntensity = isGas ? 0.48 : 0.28;
  return material;
}

function createAtmosphere(data) {
  const atmosphereStyles = {
    Venus: { color: 0xffd08a, opacity: 0.18, scale: 1.09 },
    Earth: { color: 0x5bbcff, opacity: 0.22, scale: 1.075 },
    Mars: { color: 0xff805c, opacity: 0.08, scale: 1.055 },
    Uranus: { color: 0x9bfff0, opacity: 0.13, scale: 1.06 },
    Neptune: { color: 0x5f91ff, opacity: 0.15, scale: 1.06 }
  };
  const style = atmosphereStyles[data.name];
  if (!style) {
    return null;
  }

  const atmosphere = new THREE.Mesh(
    bodyGeometry,
    new THREE.MeshBasicMaterial({
      color: style.color,
      transparent: true,
      opacity: style.opacity,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  atmosphere.scale.setScalar(data.radius * style.scale);
  return atmosphere;
}

function createPlanetHalo(data) {
  const color = data.texture === "mars" ? "#ff8062" : data.colors[1] || data.colors[0];
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture(color, data.colors[0]),
      color: new THREE.Color(color),
      transparent: true,
      opacity: data.name === "Mercury" ? 0.08 : 0.13,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  const scale = Math.max(data.radius * 4.8, 2.6);
  halo.scale.set(scale, scale, 1);
  return halo;
}

function createPlanetRing(data) {
  const inner = data.radius * data.ring.inner;
  const outer = data.radius * data.ring.outer;
  const geometry = new THREE.RingGeometry(inner, outer, 160, 1);
  const texture = makeRingTexture(data.ring.color);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: new THREE.Color(data.ring.color),
    transparent: true,
    opacity: data.ring.opacity || 0.68,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  return new THREE.Mesh(geometry, material);
}

function createOrbitPath(radius, inclination, name) {
  const points = [];
  for (let i = 0; i <= 256; i += 1) {
    const angle = (i / 256) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: name === "Earth" ? 0x56d6c9 : 0xffffff,
    transparent: true,
    opacity: name === "Earth" ? 0.32 : 0.16
  });
  const line = new THREE.LineLoop(geometry, material);
  line.rotation.z = inclination;
  line.name = `${name} orbit`;
  line.userData.baseOpacity = name === "Earth" ? 0.3 : 0.13;
  line.userData.twinkle = 0.015 + radius * 0.001;
  return line;
}

function createMoonPath(radius) {
  const points = [];
  for (let i = 0; i <= 96; i += 1) {
    const angle = (i / 96) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.LineLoop(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14 })
  );
  line.userData.baseOpacity = 0.1;
  line.userData.twinkle = 0.018;
  return line;
}

function createAsteroidBelt() {
  const count = 1150;
  const geometry = new THREE.IcosahedronGeometry(0.062, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0x6f6961,
    roughness: 0.95,
    metalness: 0.02
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  solarGroup.add(mesh);

  const dummy = new THREE.Object3D();
  const random = mulberry32(7321);
  const asteroids = Array.from({ length: count }, () => ({
    angle: random() * Math.PI * 2,
    radius: 17.4 + random() * 3.25,
    height: (random() - 0.5) * 0.72,
    speed: 0.025 + random() * 0.045,
    scale: 0.28 + random() * 1.25,
    spin: random() * Math.PI
  }));

  return {
    update(delta) {
      asteroids.forEach((asteroid, index) => {
        asteroid.angle += delta * asteroid.speed * simulationSpeed;
        asteroid.spin += delta * 0.45 * simulationSpeed;
        dummy.position.set(
          Math.cos(asteroid.angle) * asteroid.radius,
          asteroid.height,
          Math.sin(asteroid.angle) * asteroid.radius
        );
        dummy.rotation.set(asteroid.spin, asteroid.spin * 0.7, asteroid.spin * 0.45);
        dummy.scale.setScalar(asteroid.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
}

function createComet() {
  const group = new THREE.Group();
  solarGroup.add(group);
  let cometAngle = 1.4;

  const nucleus = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 24, 14),
    new THREE.MeshStandardMaterial({
      color: 0xdff9ff,
      emissive: 0x6ad8ff,
      emissiveIntensity: 0.8,
      roughness: 0.35
    })
  );
  group.add(nucleus);

  const tailTexture = makeGlowTexture("#8aefff", "#ffffff");
  const tail = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tailTexture,
      color: 0xaeefff,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  tail.scale.set(3.4, 1.05, 1);
  group.add(tail);

  return {
    update(delta) {
      cometAngle += delta * 0.07 * simulationSpeed;
      const x = Math.cos(cometAngle) * 29 + 7;
      const z = Math.sin(cometAngle) * 12;
      const y = Math.sin(cometAngle * 1.7) * 2.7 + 0.8;
      group.position.set(x, y, z);
      tail.position.set(-0.9, 0, 0);
      tail.lookAt(camera.position);
      group.lookAt(0, 0, 0);
    }
  };
}

function createStarfield() {
  const random = mulberry32(99117);
  const count = 7400;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  const starTexture = makeStarTexture();

  for (let i = 0; i < count; i += 1) {
    const radius = 160 + random() * 330;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    color.setHSL(0.55 + random() * 0.14, 0.32 + random() * 0.2, 0.72 + random() * 0.24);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      map: starTexture,
      size: 0.72,
      vertexColors: true,
      transparent: true,
      opacity: 0.76,
      depthWrite: false,
      alphaTest: 0.08,
      sizeAttenuation: true
    })
  );
  stars.name = "Starfield";
  scene.add(stars);
  bodies.push({
    update(delta, elapsed) {
      stars.material.opacity = 0.7 + Math.sin(elapsed * 0.7) * 0.055;
      stars.rotation.y += delta * 0.004;
      stars.rotation.x += delta * 0.001;
    }
  });
}

function createNebulaBackdrop() {
  const nebulaGroup = new THREE.Group();
  scene.add(nebulaGroup);

  const layers = [
    { seed: 120, colors: ["#183865", "#2d948c", "#050913"], position: [-145, 34, -220], scale: [185, 96, 1], opacity: 0.16 },
    { seed: 244, colors: ["#482c68", "#c06f52", "#060810"], position: [125, -8, -245], scale: [210, 112, 1], opacity: 0.13 },
    { seed: 382, colors: ["#0d5570", "#736848", "#030610"], position: [10, 75, -265], scale: [260, 108, 1], opacity: 0.1 }
  ];

  layers.forEach((layer) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeNebulaTexture(layer.seed, layer.colors),
        transparent: true,
        opacity: layer.opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    sprite.position.set(...layer.position);
    sprite.scale.set(...layer.scale);
    nebulaGroup.add(sprite);
  });

  bodies.push({
    update(delta) {
      nebulaGroup.rotation.y += delta * 0.0009;
      nebulaGroup.rotation.z -= delta * 0.00035;
    }
  });
}

function createGalaxyDust() {
  const random = mulberry32(3329);
  const count = 1800;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  const starTexture = makeStarTexture();

  for (let i = 0; i < count; i += 1) {
    const theta = random() * Math.PI * 2;
    const radius = 90 + random() * 180;
    positions[i * 3] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = (random() - 0.5) * 18;
    positions[i * 3 + 2] = Math.sin(theta) * radius * 0.28 - 90;
    color.setHSL(random() > 0.55 ? 0.1 : 0.48, 0.65, 0.5 + random() * 0.22);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const dust = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      map: starTexture,
      size: 1.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      alphaTest: 0.04
    })
  );
  dust.rotation.x = -0.17;
  scene.add(dust);
  bodies.push({
    update(delta, elapsed) {
      dust.material.opacity = 0.14 + Math.sin(elapsed * 0.38 + 1.1) * 0.035;
      dust.rotation.y -= delta * 0.0015;
    }
  });
}

function createPlanetButtons() {
  planetData.forEach((planet) => {
    const button = document.createElement("button");
    button.className = "planet-button";
    button.type = "button";
    button.textContent = planet.name;
    button.dataset.planet = planet.name;
    button.style.setProperty("--planet-color", planet.colors[0]);
    button.addEventListener("click", () => {
      const body = planets.find((item) => item.name === planet.name);
      if (body) {
        selectBody(body);
        startFlyTo(body);
      }
    });
    planetList.appendChild(button);
  });
}

function makeLabel(text, isMoon = false) {
  const label = document.createElement("div");
  label.className = isMoon ? "planet-label moon-label" : "planet-label";
  label.textContent = text;
  return new THREE.CSS2DObject(label);
}

function selectBody(body) {
  selectedBody = body;
  const info = body.info || body.data || sunInfo;
  infoType.textContent = info.type || body.type || "Body";
  infoName.textContent = info.name || body.name;
  infoSummary.textContent = info.summary || "";
  factDiameter.textContent = info.diameter || "Unknown";
  factDay.textContent = info.day || "Unknown";
  factYear.textContent = info.year || "Unknown";
  factMoons.textContent = info.moons || "0";
  targetReadout.textContent = body.name;
  statusText.textContent = body.name === "Sun" ? "System center selected" : `${body.name} selected`;

  document.querySelectorAll(".planet-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.planet === body.name);
  });
}

function startFlyTo(body) {
  const target = getBodyWorldPosition(body);
  const radius = Math.max(body.radius || 1, 0.6);
  let toCamera;

  if (body.name === "Sun") {
    toCamera = target.clone().add(new THREE.Vector3(11.5, 5.4, 13.2));
  } else {
    const distance = Math.max(radius * 1.65, body.type === "Moon" ? 1.15 : 1.35);
    const outward = target.clone();
    if (outward.lengthSq() < 0.001) {
      outward.set(1, 0, 1);
    }
    outward.y = 0;
    outward.normalize();
    const side = new THREE.Vector3(-outward.z, 0, outward.x).normalize();
    const offset = outward
      .multiplyScalar(distance * 1.9)
      .add(side.multiplyScalar(distance * 0.44))
      .add(new THREE.Vector3(0, distance * 0.62, 0));
    toCamera = target.clone().add(offset);
  }

  flyTo = {
    age: 0,
    duration: 1.05,
    fromCamera: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toCamera,
    toTarget: target.clone()
  };
}

function resetCamera() {
  selectedBody = sunBody;
  selectBody(sunBody);
  flyTo = {
    age: 0,
    duration: 1.15,
    fromCamera: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toCamera: new THREE.Vector3(0, 58, 78),
    toTarget: new THREE.Vector3(0, 0, 0)
  };
}

function getBodyWorldPosition(body) {
  return body.root.getWorldPosition(temporaryVectors.world).clone();
}

function updateCamera(delta) {
  if (flyTo) {
    flyTo.age += delta;
    const amount = easeInOutCubic(Math.min(flyTo.age / flyTo.duration, 1));
    camera.position.lerpVectors(flyTo.fromCamera, flyTo.toCamera, amount);
    controls.target.lerpVectors(flyTo.fromTarget, flyTo.toTarget, amount);
    if (amount >= 1) {
      flyTo = null;
    }
  } else if (selectedBody && followToggle.checked) {
    const target = getBodyWorldPosition(selectedBody);
    controls.target.lerp(target, 0.08);
  }
}

function handlePointerClick(event) {
  if (event.target.closest(".topbar, .control-panel, .info-card")) {
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(clickables, false);
  if (!hits.length) {
    return;
  }

  const body = hits[0].object.userData.body;
  if (body) {
    selectBody(body);
    startFlyTo(body);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (!isPaused) {
    bodies.forEach((body) => body.update?.(delta, elapsed));
    asteroidBelt.update(delta);
    comet.update(delta);
    updateOrbitLines(elapsed);
  }

  updateCamera(delta);
  updateSelectionMarker(delta);
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

function createSelectionMarker() {
  const marker = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.012, 8, 128),
    new THREE.MeshBasicMaterial({
      color: 0x8aefff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(1.08, 0.025, 8, 128),
    new THREE.MeshBasicMaterial({
      color: 0x56d6c9,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  marker.add(glow, ring);
  marker.visible = false;
  return marker;
}

function updateSelectionMarker(delta) {
  if (!selectedBody || !selectedBody.root) {
    selectionMarker.visible = false;
    return;
  }
  const target = getBodyWorldPosition(selectedBody);
  const radius = Math.max(selectedBody.radius || 1, 0.7);
  const color = selectedBody.data?.colors?.[1] || selectedBody.info?.color || "#8aefff";

  selectionMarker.visible = true;
  selectionMarker.position.lerp(target, Math.min(1, delta * 10));
  selectionMarker.scale.setScalar(radius * (selectedBody.name === "Sun" ? 1.33 : 1.48));
  selectionMarker.lookAt(camera.position);
  selectionMarker.rotation.z += delta * 0.8 * Math.max(simulationSpeed, 0.4);
  selectionMarker.children.forEach((child) => {
    child.material.color.set(color);
  });
}

function updateOrbitLines(elapsed) {
  orbitLines.forEach((line, index) => {
    if (!line.material || line.userData.baseOpacity === undefined) {
      return;
    }
    line.material.opacity =
      line.userData.baseOpacity + Math.sin(elapsed * 0.9 + index * 0.73) * line.userData.twinkle;
  });
}

function onResize() {
  const width = root.clientWidth;
  const height = root.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  labelRenderer.setSize(width, height);
}

function makePlanetTexture(data) {
  const cacheKey = `planet-${data.name}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey);
  }

  let texture;
  if (data.texture === "earth") {
    texture = makeEarthTexture();
  } else if (data.texture === "jupiter") {
    texture = makeGasTexture(data.colors, 844, true);
  } else if (data.texture === "saturn") {
    texture = makeGasTexture(data.colors, 533, false);
  } else if (data.texture === "ice" || data.texture === "neptune") {
    texture = makeIceTexture(data.colors, 817 + data.name.length);
  } else if (data.texture === "cloudy") {
    texture = makeCloudyPlanetTexture(data.colors, 221);
  } else if (data.texture === "mars") {
    texture = makeRockyTexture(data.colors, 667, true);
  } else {
    texture = makeRockyTexture(data.colors, 100 + data.name.length, false);
  }

  textureCache.set(cacheKey, texture);
  return texture;
}

function makeRockyTexture(colors, seed, polarCaps) {
  const { canvas, context } = createTextureCanvas();
  const random = mulberry32(seed);
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, lighten(colors[0], 16));
  gradient.addColorStop(0.5, colors[0]);
  gradient.addColorStop(1, darken(colors[2], 6));
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawNoise(context, canvas, colors[2], 1900, 0.025, random);
  drawNoise(context, canvas, colors[1], 980, 0.02, random);

  for (let i = 0; i < 120; i += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const r = 2 + random() * 14;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.strokeStyle = withAlpha(colors[2], 0.28);
    context.lineWidth = 1 + random() * 2;
    context.stroke();
    context.fillStyle = withAlpha("#050505", 0.04);
    context.fill();
  }

  if (polarCaps) {
    context.fillStyle = "rgba(255,255,245,0.72)";
    context.beginPath();
    context.ellipse(canvas.width * 0.5, 18, canvas.width * 0.25, 22, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(canvas.width * 0.5, canvas.height - 18, canvas.width * 0.2, 18, 0, 0, Math.PI * 2);
    context.fill();
  }

  return textureFromCanvas(canvas);
}

function makeCloudyPlanetTexture(colors, seed) {
  const texture = makeRockyTexture(colors, seed, false);
  const canvas = texture.image;
  const context = canvas.getContext("2d");
  const random = mulberry32(seed + 91);

  for (let i = 0; i < 180; i += 1) {
    const y = random() * canvas.height;
    const height = 4 + random() * 16;
    context.fillStyle = withAlpha(i % 2 ? colors[1] : "#ffffff", 0.08 + random() * 0.12);
    context.fillRect(0, y, canvas.width, height);
  }

  texture.needsUpdate = true;
  return texture;
}

function makeEarthTexture() {
  const { canvas, context } = createTextureCanvas();
  const ocean = context.createLinearGradient(0, 0, 0, canvas.height);
  ocean.addColorStop(0, "#1d5c99");
  ocean.addColorStop(0.5, "#207bb8");
  ocean.addColorStop(1, "#102f65");
  context.fillStyle = ocean;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const random = mulberry32(4444);
  const landColors = ["#3f9c54", "#87b55f", "#d8bf83", "#2b7047"];
  for (let i = 0; i < 34; i += 1) {
    const x = random() * canvas.width;
    const y = 55 + random() * (canvas.height - 110);
    const radiusX = 28 + random() * 96;
    const radiusY = 12 + random() * 48;
    context.fillStyle = withAlpha(landColors[Math.floor(random() * landColors.length)], 0.92);
    drawBlob(context, x, y, radiusX, radiusY, random, 12);
  }

  drawNoise(context, canvas, "#d7e9ff", 1400, 0.01, random);
  context.fillStyle = "rgba(238,246,240,0.58)";
  context.fillRect(0, 0, canvas.width, 18);
  context.fillRect(0, canvas.height - 18, canvas.width, 18);

  return textureFromCanvas(canvas);
}

function makeCloudTexture(seed = 823) {
  const { canvas, context } = createTextureCanvas();
  const random = mulberry32(seed);
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 120; i += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const width = 28 + random() * 145;
    const height = 5 + random() * 18;
    const alpha = 0.045 + random() * 0.095;
    const gradient = context.createRadialGradient(x, y, 1, x, y, width);
    gradient.addColorStop(0, `rgba(226,240,248,${alpha})`);
    gradient.addColorStop(1, "rgba(226,240,248,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(x, y, width, height, random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  return textureFromCanvas(canvas);
}

function makeGasTexture(colors, seed, redSpot) {
  const { canvas, context } = createTextureCanvas();
  const random = mulberry32(seed);
  context.fillStyle = colors[0];
  context.fillRect(0, 0, canvas.width, canvas.height);

  let y = 0;
  while (y < canvas.height) {
    const bandHeight = 12 + random() * 34;
    const color = colors[Math.floor(random() * colors.length)];
    context.fillStyle = withAlpha(color, 0.55 + random() * 0.36);
    context.fillRect(0, y, canvas.width, bandHeight);

    context.fillStyle = withAlpha(lighten(color, 10), random() * 0.07);
    for (let x = 0; x < canvas.width; x += 28) {
      const wave = Math.sin((x / canvas.width) * Math.PI * 8 + y * 0.06) * 5;
      context.fillRect(x, y + wave, 28, bandHeight * 0.56);
    }
    y += bandHeight;
  }

  drawNoise(context, canvas, colors[2], 1200, 0.018, random);

  if (redSpot) {
    context.fillStyle = "rgba(188,77,55,0.82)";
    context.beginPath();
    context.ellipse(canvas.width * 0.68, canvas.height * 0.56, 72, 28, -0.08, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(255,218,180,0.34)";
    context.lineWidth = 5;
    context.stroke();
  }

  return textureFromCanvas(canvas);
}

function makeIceTexture(colors, seed) {
  const { canvas, context } = createTextureCanvas();
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, lighten(colors[1], 4));
  gradient.addColorStop(0.5, colors[0]);
  gradient.addColorStop(1, darken(colors[2], 6));
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const random = mulberry32(seed);
  for (let i = 0; i < 72; i += 1) {
    const y = random() * canvas.height;
    context.fillStyle = withAlpha(i % 2 ? colors[1] : "#ffffff", 0.04 + random() * 0.07);
    context.fillRect(0, y, canvas.width, 2 + random() * 8);
  }
  drawNoise(context, canvas, colors[1], 620, 0.012, random);

  return textureFromCanvas(canvas);
}

function makeMoonTexture(color, seed) {
  const { canvas, context } = createTextureCanvas(512, 256);
  const random = mulberry32(seed);
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, lighten(color, 12));
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, darken(color, 18));
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawNoise(context, canvas, "#1b1714", 900, 0.024, random);

  for (let i = 0; i < 90; i += 1) {
    context.beginPath();
    context.arc(random() * canvas.width, random() * canvas.height, 1 + random() * 9, 0, Math.PI * 2);
    context.fillStyle = "rgba(0,0,0,0.08)";
    context.fill();
  }

  return textureFromCanvas(canvas);
}

function makeSunTexture() {
  const { canvas, context } = createTextureCanvas();
  const random = mulberry32(99);
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#fff7b4");
  gradient.addColorStop(0.34, "#ffc65c");
  gradient.addColorStop(0.68, "#f26f4f");
  gradient.addColorStop(1, "#b63c24");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 900; i += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const size = 12 + random() * 80;
    const glow = context.createRadialGradient(x, y, 1, x, y, size);
    glow.addColorStop(0, "rgba(255,255,210,0.28)");
    glow.addColorStop(1, "rgba(255,80,20,0)");
    context.fillStyle = glow;
    context.fillRect(x - size, y - size, size * 2, size * 2);
  }

  return textureFromCanvas(canvas);
}

function makeStarTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, "rgba(214,234,255,0.9)");
  gradient.addColorStop(0.42, "rgba(120,170,255,0.28)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return textureFromCanvas(canvas);
}

function makeNebulaTexture(seed, colors) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  const random = mulberry32(seed);
  context.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 44; i += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const radius = 70 + random() * 190;
    const color = colors[Math.floor(random() * colors.length)];
    const gradient = context.createRadialGradient(x, y, 1, x, y, radius);
    gradient.addColorStop(0, withAlpha(color, 0.11 + random() * 0.12));
    gradient.addColorStop(0.42, withAlpha(color, 0.035 + random() * 0.055));
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  for (let i = 0; i < 1600; i += 1) {
    const alpha = random() * 0.026;
    context.fillStyle = `rgba(255,255,255,${alpha})`;
    context.fillRect(random() * canvas.width, random() * canvas.height, 1, 1);
  }

  return textureFromCanvas(canvas);
}

function makeGlowTexture(inner, outer) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(256, 256, 10, 256, 256, 256);
  gradient.addColorStop(0, withAlpha("#ffffff", 0.95));
  gradient.addColorStop(0.23, withAlpha(inner, 0.64));
  gradient.addColorStop(0.55, withAlpha(outer, 0.18));
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 512);
  return textureFromCanvas(canvas);
}

function makeRingTexture(color) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  const random = mulberry32(color.length * 411);
  context.clearRect(0, 0, canvas.width, canvas.height);

  for (let x = 0; x < canvas.width; x += 1) {
    const alpha =
      0.055 +
      Math.pow(Math.sin((x / canvas.width) * Math.PI), 0.7) * 0.48 +
      random() * 0.05;
    const bandColor = x % 29 < 3 ? darken(color, 28) : x % 17 < 5 ? lighten(color, 11) : color;
    context.fillStyle = withAlpha(bandColor, alpha);
    context.fillRect(x, 0, 1, canvas.height);
  }

  const texture = textureFromCanvas(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function createTextureCanvas(width = 1536, height = 768) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  return { canvas, context };
}

function textureFromCanvas(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  if ("colorSpace" in texture && THREE.SRGBColorSpace) {
    texture.colorSpace = THREE.SRGBColorSpace;
  } else {
    texture.encoding = THREE.sRGBEncoding;
  }
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  texture.needsUpdate = true;
  return texture;
}

function drawNoise(context, canvas, color, amount, alpha, random) {
  for (let i = 0; i < amount; i += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const size = 0.5 + random() * 3.5;
    context.fillStyle = withAlpha(color, alpha * (0.35 + random()));
    context.fillRect(x, y, size, size);
  }
}

function drawBlob(context, x, y, radiusX, radiusY, random, points) {
  context.beginPath();
  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const variance = 0.68 + random() * 0.58;
    const px = x + Math.cos(angle) * radiusX * variance;
    const py = y + Math.sin(angle) * radiusY * variance;
    if (i === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
  }
  context.closePath();
  context.fill();
}

function withAlpha(hex, alpha) {
  const color = new THREE.Color(hex);
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(
    color.b * 255
  )}, ${alpha})`;
}

function lighten(hex, amount) {
  const color = new THREE.Color(hex);
  color.offsetHSL(0, 0, amount / 100);
  return `#${color.getHexString()}`;
}

function darken(hex, amount) {
  const color = new THREE.Color(hex);
  color.offsetHSL(0, 0, -amount / 100);
  return `#${color.getHexString()}`;
}

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

pauseButton.addEventListener("click", () => {
  isPaused = !isPaused;
  pauseButton.textContent = isPaused ? "Play" : "Pause";
  document.body.classList.toggle("is-paused", isPaused);
  statusText.textContent = isPaused ? "Simulation paused" : `${selectedBody?.name || "Sun"} selected`;
});

resetButton.addEventListener("click", resetCamera);

speedSlider.addEventListener("input", () => {
  simulationSpeed = Number(speedSlider.value);
  const label = `${simulationSpeed.toFixed(1)}x`;
  speedValue.textContent = label;
  speedReadout.textContent = label;
});

labelsToggle.addEventListener("change", () => {
  document.body.classList.toggle("hide-labels", !labelsToggle.checked);
});

orbitsToggle.addEventListener("change", () => {
  orbitLines.forEach((line) => {
    line.visible = orbitsToggle.checked;
  });
});

window.addEventListener("resize", onResize);
window.addEventListener("pointerdown", handlePointerClick);
