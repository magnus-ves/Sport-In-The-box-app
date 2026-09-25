# SIB Kontroll – iPad-app (Expo)

Fjernkontroll for **Sport In The Box** som egen app på iPad (og iPhone/Android).
Appen snakker **direkte** med SIB sitt REST-API på lokalnettet. Det trengs ingen
server eller PC-program i tillegg.

```
iPad (SIB Kontroll)  ──wifi──►  Sport In The Box-API (http://<SIB-PC>:8080)
```

## Funksjoner

| Fane | Hva den gjør |
|---|---|
| **Hurtigknapper** | Alle QuickButtons i gruppene sine, med farge, ikon og hurtigtast. Trykk for å trigge. |
| **Rundown** | Velg rundown, se alle elementer. Trykk på en rad for å kjøre den. Kjør forrige/valgt/neste, flytt markering opp/ned, vis rundownen i SIB. Markeringen følger SIB live (hvert 2. sekund). |
| **Spillelister** | Start fra begynnelsen, fortsett fra sist, eller spill en bestemt fil. |
| **Streaming** | Se strømmer, start og stopp (med bekreftelse før stopp). |
| **Innstillinger** | SIB-adresse, API-passord (lagres i nøkkelringen), spilleliste-ID-er, «hold skjermen våken», og felt for egendefinerte API-kall. |

Vibrasjon (haptikk) og en kort melding bekrefter hver kommando. Tilkoblingsstatus vises øverst.

## Kom i gang på iPaden – raskest med Expo Go

1. Installer **Expo Go** fra App Store på iPaden.
2. På en PC/Mac på samme wifi (med [Node.js](https://nodejs.org) installert):

   ```bash
   cd sib-app
   npm install
   npx expo start
   ```

3. Skann QR-koden med kameraet på iPaden, så åpnes appen i Expo Go.
4. Tillat **Lokalt nettverk** når iPaden spør.
5. Gå til **Innstillinger**, skriv inn IP-adressen til SIB-PC-en (f.eks. `192.168.1.50`;
   port 8080 legges til automatisk), eventuelt passord, og trykk **Lagre**.

> Finn IP-adressen på SIB-PC-en med `ipconfig` i en kommandolinje (IPv4-adresse).
> REST-API-et må være skrudd på i Sport In The Box.

## Egen app på iPaden via TestFlight

Appen bygges i skyen med [EAS](https://docs.expo.dev/build/introduction/) og lastes opp til
TestFlight. Du trenger ikke Mac eller Xcode, men du trenger en Apple Developer-konto og en
Expo-konto.

### Første gang (fra din egen PC/Mac, ca. 30 min)

Første bygg må kjøres interaktivt, fordi EAS må logge inn hos Apple for å lage sertifikater
og app-oppføringen i App Store Connect.

```bash
cd sib-app
npm install
npx expo install --fix                 # sikrer riktige pakkeversjoner for SDK 57
npx eas-cli@latest login               # Expo-kontoen
npx eas-cli@latest init                # lager EAS-prosjektet, skriver projectId i app.json
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

Under bygget svarer du på spørsmålene:

- **Logg inn på Apple-kontoen:** ja. Bruk Apple-ID-en som er med i Developer-programmet.
- **Generer distribusjonssertifikat og provisioning profile:** ja, la EAS håndtere det.
- **Bundle identifier `no.sibkontroll.app`:** godta, eller bytt i `app.json` hvis den er tatt.
- Ved innsending: la EAS **opprette appen i App Store Connect**. Er navnet «SIB Kontroll» tatt,
  endre `name` i `app.json` (f.eks. «SIB Kontroll Arena»).

Bygget tar 15–25 min, og etter opplasting bruker Apple 5–30 min på å behandle det.
Commit endringen `eas init` gjorde i `app.json` (`extra.eas.projectId` og `owner`).

### Installere på iPadene

1. [App Store Connect](https://appstoreconnect.apple.com) → **Apper** → SIB Kontroll → **TestFlight**.
2. Under **Intern testing**, lag en gruppe og legg til personene (må være brukere i
   App Store Connect-teamet, opptil 100). Svar på spørsmålet om eksportsamsvar hvis det kommer.
   `usesNonExemptEncryption: false` er satt, så det skal normalt ikke dukke opp.
3. De får e-post, installerer **TestFlight** fra App Store og deretter SIB Kontroll.

Interne TestFlight-bygg må ikke gjennom Apples gjennomgang, men de **utløper etter 90 dager**.
Bygg en ny versjon før det.

### Senere bygg

Kjør samme kommando igjen (`build --platform ios --profile production --auto-submit`).
Byggnummeret økes automatisk. Hvis du kobler GitHub-repoet til Expo-prosjektet
(expo.dev → prosjektet → **GitHub**, base directory `sib-app`), kan nye bygg startes fra
nettsiden uten din PC.

## Test uten Sport In The Box

`../sib-kontroll/mock-sib.js` etterligner SIB-API-et med eksempeldata fra dokumentasjonen:

```bash
node ../sib-kontroll/mock-sib.js     # port 8080, valgfritt MOCK_PASSWORD=hemmelig
```

Pek appen til IP-adressen til maskinen som kjører mocken, og legg inn spilleliste-ID `1` og `5`.

## Utvikling

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
```

```
src/
  app/                  Skjermer (Expo Router)
    _layout.tsx         Rot: innstillinger, holde skjermen våken, toast
    (tabs)/             Fanene: index (hurtigknapper), rundown, playlists, streams, settings
  components/ui.tsx     Felles knapper, statusmerke, toast
  lib/sib.ts            API-klient, stier og typer for SIB REST V2
  lib/store.tsx         App-tilstand: innstillinger, tilkoblingssjekk, kommandoer
```

Merk: iOS-oppsettet i `app.json` tillater vanlig `http` (SIB-API-et har ikke https) og ber om
tilgang til lokalt nettverk.
