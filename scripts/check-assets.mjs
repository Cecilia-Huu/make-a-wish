import {readFile,stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'

const root=new URL('../',import.meta.url)
for(const name of ['gesture_recognizer','face_landmarker','hand_landmarker']){
  const path=`public/models/${name}.task`,bytes=await readFile(new URL(path,root))
  assert.ok(bytes.length>1_000_000,`${path} is missing or truncated`)
  // MediaPipe task bundles have a two-byte alignment prefix before the ZIP header.
  assert.ok(bytes.subarray(0,8).includes(Buffer.from('PK\x03\x04')),`${path} must be a MediaPipe task bundle`)
}
for(const suffix of ['internal','module_internal','nosimd_internal']){
  for(const ext of ['js','wasm']){
    const file=`vision_wasm_${suffix}.${ext}`
    const bundled=await readFile(new URL(`public/wasm/${file}`,root))
    const installed=await readFile(new URL(`node_modules/@mediapipe/tasks-vision/wasm/${file}`,root))
    assert.equal(createHash('sha256').update(bundled).digest('hex'),createHash('sha256').update(installed).digest('hex'),`${file} differs from the locked MediaPipe runtime`)
  }
}
for(const file of ['public/favicon.svg','public/share-cover.png'])assert.ok((await stat(new URL(file,root))).size>100,`${file} missing`)
console.log('Verified 3 task models, 6 matching MediaPipe runtime files, favicon and share cover.')
