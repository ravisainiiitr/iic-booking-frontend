import { buildStlMesh, type StlMeshOptions } from "./stlMesh";

interface WorkerScope {
  onmessage: ((e: MessageEvent<{ id: number; buffer: ArrayBuffer; options: StlMeshOptions }>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (e) => {
  const { id, buffer, options } = e.data;
  try {
    const mesh = buildStlMesh(buffer, options, (phase, fraction) => scope.postMessage({ id, type: "progress", phase, fraction }));
    scope.postMessage({ id, type: "done", mesh }, [mesh.positions.buffer, mesh.normals.buffer]);
  } catch (err) {
    scope.postMessage({ id, type: "error", message: err instanceof Error ? err.message : "Could not read the STL file." });
  }
};
