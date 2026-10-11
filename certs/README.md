# Dev TLS certificate

The backend container serves HTTPS with a self-signed certificate (`studies-senswave-backend/docker/generate-cert.sh`, SAN `api`, `localhost`, `127.0.0.1`). The app trusts it only for the hosts listed in `EXPO_PUBLIC_DEV_CA_HOSTS`, in every build type. Production hosts must never be listed.

Setup for the Android emulator:

1. Copy `studies-senswave-backend/docker/https/senswave.api.crt` to `certs/dev-ca.crt` (not committed).
2. In `.env`: `EXPO_PUBLIC_DEV_CA_HOSTS=localhost` and `EXPO_PUBLIC_SENSWAVE__API__URL=https://localhost:7070`.
3. Forward the port: `adb reverse tcp:7070 tcp:7070`.
4. Rebuild native code: `npx expo prebuild --platform android --clean`, then `npx expo run:android`.

Without the certificate or hosts the plugin does nothing and the app trusts system CAs only.
