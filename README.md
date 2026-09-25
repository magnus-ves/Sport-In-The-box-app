# Sport In The Box Control

Fjernkontroll for **Sport In The Box** via SIB sitt REST-API: hurtigknapper, rundown,
spillelister og streaming.

| Mappe | Hva |
|---|---|
| [`sib-app/`](sib-app/README.md) | iPad-app (Expo/React Native) som kobler seg direkte til SIB. Distribueres via TestFlight. |
| [`sib-kontroll/`](sib-kontroll/README.md) | Nettleserversjon: en liten Node-server på PC-en som nettbrett og mobil åpner i nettleseren. Inneholder også `mock-sib.js` for testing uten SIB. |

## Kom i gang

- **iPad-appen:** se [`sib-app/README.md`](sib-app/README.md) for Expo Go og TestFlight.
- **Nettleserversjonen:** `cd sib-kontroll && node server.js`, og åpne adressen den viser på nettbrettet.

Expo-prosjektet er koblet via `extra.eas.projectId` i `sib-app/app.json`. Kobler du dette repoet
til prosjektet på expo.dev, sett **base directory** til `sib-app`.
