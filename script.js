const gridSize = 500, cubeSize = 1, defaultColor = '#ff0000';
let isometricView = false, perspectiveCamera, orthoCamera, activeCamera, selectedColor = defaultColor;
let scene, renderer, controls, raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2(), cubes = new Map(), highlightMesh, gridHelper;
let ambientLight, ambientLightOn = true, sunlight, sunlightOn = true;

class SunLight {
    constructor(scene) {
        this.light = new THREE.DirectionalLight(0xffffff, 0.8);
        this.light.position.set(10, 10, 10);
        scene.add(this.light);
        this.initControls();
        this.updateLightPosition(); 
    }

    initControls() {
        ['light-azimuth', 'light-elevation', 'light-intensity'].forEach(id => {
            const input = document.getElementById(id);
            const display = document.getElementById(`${id}-value`);
            
            input.addEventListener('input', (event) => {
                display.textContent = event.target.value;
                if (id === 'light-intensity') {
                    this.light.intensity = parseFloat(event.target.value);
                } else {
                    this.updateLightPosition();
                }
            });
        });

        const colorInput = document.getElementById('light-color');
        colorInput.addEventListener('input', (event) => {
            this.light.color.set(event.target.value); 
        });
    }

    updateLightPosition() {
        const azimuth = THREE.MathUtils.degToRad(document.getElementById('light-azimuth').value);
        const elevation = THREE.MathUtils.degToRad(document.getElementById('light-elevation').value);
        this.light.position.set(
            Math.cos(azimuth) * Math.cos(elevation) * 10,
            Math.sin(elevation) * 10,
            Math.sin(azimuth) * Math.cos(elevation) * 10
        );
    }

    toggle() {
        this.light.visible = !this.light.visible;
    }
}

class SceneManager {
    constructor() {
        scene = new THREE.Scene();
        perspectiveCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        orthoCamera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 1000);
        activeCamera = isometricView ? orthoCamera : perspectiveCamera;

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        document.getElementById('container-3d').appendChild(renderer.domElement);

        controls = new THREE.OrbitControls(perspectiveCamera, renderer.domElement);
        perspectiveCamera.position.set(10, 10, 10);
        orthoCamera.position.copy(perspectiveCamera.position);
        orthoCamera.lookAt(scene.position);
        perspectiveCamera.lookAt(scene.position);
        controls.update();

        gridHelper = new THREE.GridHelper(gridSize * cubeSize, gridSize, 0x4367ff, 0xe4e4e4);
        gridHelper.position.y = -cubeSize / 2;
        scene.add(gridHelper);

        highlightMesh = this.createHighlightMesh();
        scene.add(highlightMesh);

        ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        scene.add(ambientLight);
        this.initAmbientControls();

        sunlight = new SunLight(scene); 
    }

    initAmbientControls() {
        const ambientIntensityInput = document.getElementById('ambient-intensity');
        ambientIntensityInput.addEventListener('input', (event) => {
            ambientLight.intensity = parseFloat(event.target.value);
            document.getElementById('ambient-intensity-value').textContent = event.target.value;
        });

        const ambientColorInput = document.getElementById('ambient-color');
        ambientColorInput.addEventListener('input', (event) => {
            ambientLight.color.set(event.target.value);
        });
    }

    createHighlightMesh() {
        return new THREE.Mesh(
            new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize),
            new THREE.MeshBasicMaterial({
                color: 0x808080,
                opacity: 0.3,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: true,
                blending: THREE.NormalBlending
            })
        );
    }

    toggleCameraView() {
        isometricView = !isometricView;
        activeCamera = isometricView ? orthoCamera : perspectiveCamera;
        controls.object = activeCamera;
        controls.update();
    }
}

class CubeManager {
    createCube(position) {
        const cube = new THREE.Mesh(new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize), new THREE.MeshLambertMaterial({ color: selectedColor }));
        cube.position.copy(position);
        cube.castShadow = true;
        cube.receiveShadow = true;
        cubes.set(JSON.stringify(position), cube);
        scene.add(cube);
    }

    removeCube(cube) {
        cubes.delete(JSON.stringify(cube.position));
        scene.remove(cube);
    }

    handleCubePlacement(intersects) {
        const position = intersects.length > 0 ? this.getNextCubePosition(intersects[0]) : this.getGridPosition();
        const positionKey = JSON.stringify(position);
        if (!cubes.has(positionKey)) {
            this.createCube(position);
        }
    }

    getNextCubePosition(intersect) {
        return intersect.object.position.clone().add(intersect.face.normal.clone().multiplyScalar(cubeSize));
    }

    getGridPosition() {
        raycaster.setFromCamera(mouse, activeCamera); 
        const intersectsGrid = raycaster.intersectObject(scene.children[0]);
        const position = intersectsGrid[0].point;
        position.x = Math.floor(position.x / cubeSize) * cubeSize + cubeSize / 2;
        position.y = 0;
        position.z = Math.floor(position.z / cubeSize) * cubeSize + cubeSize / 2;
        return position;
    }
}

class EventManager {
    constructor(sceneManager, cubeManager) {
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('keydown', this.onKeyPress.bind(this, cubeManager));
        document.getElementById('toggleView').addEventListener('click', sceneManager.toggleCameraView.bind(sceneManager));
        document.querySelectorAll('.color-input').forEach(input => {
            input.addEventListener('click', () => selectedColor = input.value);
            input.addEventListener('input', () => selectedColor = input.value);
        });
        window.addEventListener('resize', this.onWindowResize);
    }

    onKeyPress(cubeManager, event) {
        raycaster.setFromCamera(mouse, activeCamera); 
        const intersects = raycaster.intersectObjects([...cubes.values()]);

        if (event.key === 'a') cubeManager.handleCubePlacement(intersects);
        if (event.key === 's' && intersects.length > 0) cubeManager.removeCube(intersects[0].object);
        if (event.key === 'd') gridHelper.visible = !gridHelper.visible;

        if (event.key === 'w' || event.key === 'W') {
            ambientLightOn = !ambientLightOn;
            ambientLight.visible = ambientLightOn;
        }

        if (event.key === 'e' || event.key === 'E') {
            sunlightOn = !sunlightOn;
            sunlight.light.visible = sunlightOn;
        }
    }

    onMouseMove(event) {
        mouse.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
        raycaster.setFromCamera(mouse, activeCamera); 
        const intersects = raycaster.intersectObjects([...cubes.values()]);
        highlightMesh.visible = intersects.length > 0 || raycaster.intersectObject(scene.children[0]).length > 0;
        if (highlightMesh.visible) highlightMesh.position.copy(intersects.length > 0 ? cubeManager.getNextCubePosition(intersects[0]) : cubeManager.getGridPosition());
    }

    onWindowResize() {
        const aspect = window.innerWidth / window.innerHeight;
        perspectiveCamera.aspect = aspect;
        perspectiveCamera.updateProjectionMatrix();
        orthoCamera.left = -10 * aspect;
        orthoCamera.right = 10 * aspect;
        orthoCamera.top = 10;
        orthoCamera.bottom = -10;
        orthoCamera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

class FileManager {
    constructor() {
        document.getElementById('fileInput').addEventListener('change', this.uploadScene);
        document.getElementById('downloadBtn').addEventListener('click', this.downloadScene);
    }

    uploadScene(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const data = JSON.parse(event.target.result);
                data.forEach(item => {
                    const position = new THREE.Vector3(item.position.x, item.position.y, item.position.z);
                    selectedColor = `#${item.color}`;
                    cubeManager.createCube(position);
                });
            };
            reader.readAsText(file);
        }
    }

    downloadScene() {
        const data = [...cubes.values()].map(cube => ({
            position: cube.position,
            color: cube.material.color.getHexString()
        }));
        const json = JSON.stringify(data);
        const blob = new Blob([json], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'scene.json';
        link.click();
    }
}

const sceneManager = new SceneManager();
const cubeManager = new CubeManager();
new EventManager(sceneManager, cubeManager);
new FileManager();

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, activeCamera); 
}
animate();

document.getElementById('downloadPngBtn').addEventListener('click', function () {
    renderer.setClearColor(0x000000, 0); 
    renderer.render(scene, activeCamera);
    const link = document.createElement('a');
    link.href = renderer.domElement.toDataURL('image/png');
    link.download = 'scene.png';
    link.click();
});
