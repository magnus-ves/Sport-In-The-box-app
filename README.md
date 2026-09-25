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

## Bygge til TestFlight uten PC (fra iPad)

iPad-appen bygges i Expos sky og sendes til TestFlight av GitHub Actions-workflowen
[`iOS → TestFlight`](.github/workflows/testflight.yml). Alt oppsett gjøres i nettleseren.

### 1. Lag en App Store Connect API-nøkkel

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Brukere og tilgang** →
   **Integrasjoner** → **App Store Connect API** → **Teamnøkler** → **+**.
2. Navn: `EAS`, tilgang: **Admin**. Last ned `.p8`-filen. Den kan bare lastes ned én gang.
3. Noter **Key ID** (i listen) og **Issuer ID** (øverst på siden).

### 2. Lag et Expo-token

[expo.dev](https://expo.dev) → **Account settings** → **Access tokens** → **Create token**.

### 3. Finn Team ID

[developer.apple.com/account](https://developer.apple.com/account) → **Membership details** → **Team ID**.
Der ser du også om kontoen er for en person (`INDIVIDUAL`) eller en organisasjon
(`COMPANY_OR_ORGANIZATION`).

### 4. Legg inn secrets i GitHub

Repoet → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Navn | Verdi |
|---|---|
| `EXPO_TOKEN` | Tokenet fra steg 2 |
| `ASC_API_KEY_P8` | Hele teksten i `.p8`-filen, med `-----BEGIN PRIVATE KEY-----` og `-----END PRIVATE KEY-----` |
| `ASC_KEY_ID` | Key ID |
| `ASC_ISSUER_ID` | Issuer ID |
| `APPLE_TEAM_ID` | Team ID |
| `APPLE_TEAM_TYPE` | `INDIVIDUAL` eller `COMPANY_OR_ORGANIZATION` |

> Slik får du teksten i `.p8`-filen på iPad: åpne **Filer**, gi filen nytt navn så den slutter
> på `.txt`, åpne den og kopier alt.

### 5. Første bygg

GitHub → **Actions** → **iOS → TestFlight** → **Run workflow** → `build-only`.
Dette lager sertifikat, provisioning profile og app-ID-en `no.sibkontroll.app` hos Apple, og
starter bygget hos Expo (15–25 min, følg det på expo.dev).

### 6. Opprett appen i App Store Connect og send til TestFlight

1. App Store Connect → **Apper** → **+** → **Ny app**: iOS, navn «SIB Kontroll» (eller et
   annet ledig navn), bundle-ID `no.sibkontroll.app`, SKU f.eks. `sib-kontroll`.
2. Åpne appen → **App-informasjon** → kopier **Apple-ID** (et tall).
3. Legg den inn som secret `ASC_APP_ID`.
4. Kjør workflowen på nytt med `submit-latest`. Senere bygg tar du med `build-and-submit`.

Deretter: App Store Connect → appen → **TestFlight** → **Intern testing** → legg til testere.
Interne TestFlight-bygg utløper etter 90 dager.
