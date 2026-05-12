import * as THREE from "three";

declare module "three/examples/jsm/loaders/GLTFLoader" {
  export class GLTFLoader extends THREE.Loader {
    constructor(manager?: THREE.LoadingManager);
    load(
      url: string,
      onLoad: (gltf: { scene: THREE.Group }) => void,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
      onError?: (event: ErrorEvent) => void,
    ): void;
    setDRACOLoader(dracoLoader: DRACOLoader): this;
    parse(data: ArrayBuffer, path: string, onLoad: (gltf: { scene: THREE.Group }) => void, onError?: (error: ErrorEvent) => void): void;
  }
}

declare module "three/examples/jsm/loaders/DRACOLoader" {
  export class DRACOLoader extends THREE.Loader {
    constructor(manager?: THREE.LoadingManager);
    setDecoderPath(path: string): this;
    setDecoderConfig(config: Record<string, unknown>): this;
    dispose(): void;
  }
}
