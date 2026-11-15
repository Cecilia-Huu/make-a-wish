# Third-party resources

React, Vite, Three.js and MediaPipe are used through npm. Their upstream licenses remain applicable; versions are pinned by `package-lock.json`.

The bundled MediaPipe runtime comes from `@mediapipe/tasks-vision` (Apache-2.0): https://github.com/google-ai-edge/mediapipe .

The pretrained task files were retrieved from Google's official model distribution:

- https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task
- https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task

Documentation and model information: https://ai.google.dev/edge/mediapipe/solutions/guide . Consult upstream terms and model information when redistributing or replacing model files.

Google Fonts supplies optional fonts via its CSS service. System fonts are used if unavailable. The share cover is original generated artwork without people; it is not a photo of the live procedural cake.
