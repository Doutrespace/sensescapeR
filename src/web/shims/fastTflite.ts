/**
 * Web replacement for `react-native-fast-tflite`, backed by LiteRT.js
 * (Google's TFLite runtime compiled to WebAssembly). Exposes the same
 * `loadTensorflowModel` / `model.run` surface the hooks already use, so the
 * same .tflite files run in the browser.
 */
import { Asset } from 'expo-asset';
import { publicAssetUrl } from '../mediaStore';

export interface Tensor {
  name: string;
  dataType: string;
  shape: number[];
}

type TypedArray =
  | Float32Array
  | Float64Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | BigInt64Array
  | BigUint64Array;

export interface TensorflowModel {
  delegate: string;
  inputs: Tensor[];
  outputs: Tensor[];
  run: (inputs: TypedArray[]) => Promise<TypedArray[]>;
  runSync: (inputs: TypedArray[]) => TypedArray[];
}

type ModelSource = number | string | { url?: string; uri?: string };

let runtimePromise: Promise<typeof import('@litertjs/core')> | null = null;

function loadRuntime(): Promise<typeof import('@litertjs/core')> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const litert = await import('@litertjs/core');
      await litert.loadLiteRt(publicAssetUrl('litert/'));
      return litert;
    })().catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

async function resolveModelUrl(source: ModelSource): Promise<string> {
  if (typeof source === 'string') {
    return source;
  }
  if (typeof source === 'number') {
    const asset = Asset.fromModule(source);
    return asset.uri;
  }
  const url = source.url ?? source.uri;
  if (!url) {
    throw new Error('Unsupported TFLite model source.');
  }
  return url;
}

function describeTensors(details: readonly any[]): Tensor[] {
  return details.map((detail) => ({
    name: detail.name,
    dataType: String(detail.dtype),
    shape: Array.from(detail.shape as ArrayLike<number>),
  }));
}

function elementCount(shape: number[]): number {
  return shape.reduce((total, dimension) => total * dimension, 1);
}

export async function loadTensorflowModel(
  source: ModelSource,
  _delegate?: string
): Promise<TensorflowModel> {
  const litert = await loadRuntime();
  const url = await resolveModelUrl(source);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download model (${response.status}): ${url}`);
  }
  const modelBytes = new Uint8Array(await response.arrayBuffer());
  const compiled = await litert.loadAndCompile(modelBytes, { accelerator: 'wasm' });

  const inputs = describeTensors(compiled.getInputDetails());
  const outputs = describeTensors(compiled.getOutputDetails());

  const run = async (inputData: TypedArray[]): Promise<TypedArray[]> => {
    const inputTensors = inputData.map((data, index) => {
      const declaredShape = inputs[index]?.shape ?? [];
      const hasStaticShape = declaredShape.length > 0
        && declaredShape.every((dimension) => dimension > 0)
        && elementCount(declaredShape) === data.length;
      return new litert.Tensor(data as any, hasStaticShape ? declaredShape : [data.length]);
    });

    let outputTensors: any[] = [];
    try {
      outputTensors = await compiled.run(inputTensors);
      // Copy out of WASM memory before the tensors are released.
      return outputTensors.map((tensor) => (tensor.toTypedArray() as any).slice() as TypedArray);
    } finally {
      inputTensors.forEach((tensor) => tensor.delete());
      outputTensors.forEach((tensor) => tensor.delete());
    }
  };

  return {
    delegate: 'default',
    inputs,
    outputs,
    run,
    runSync: () => {
      throw new Error('runSync is not available in the browser; use run().');
    },
  };
}
