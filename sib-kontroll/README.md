# SIB Kontroll

Fjernkontroll for **Sport In The Box** fra nettbrett eller mobil, via SIB sitt
REST-API (`http://localhost:8080/api/...`).

```
 iPad / mobil  ──wifi──►  SIB Kontroll-server (:3000)  ──►  Sport In The Box-API (:8080)
```

En liten Node-server uten avhengigheter serverer appen og videresender
kommandoene til SIB. Det gjør at nettbrettet ikke møter CORS-sperrer, og
API-passordet lagres bare på serveren — det sendes aldri ut til nettbrettene.

## Funksjoner

| Fane | Hva den gjør | API |
|---|---|---|
| **Hurtigknapper** | Alle QuickButtons i gruppene sine, med farge, ikon og hurtigtast. Trykk for å trigge. | `quickbutton/`, `quickbutton/trig/{id}` |
| **Rundown** | Velg rundown, se alle elementer (ident, klokkeslett, navn). Trykk på en rad for å kjøre den. Kjør forrige/valgt/neste, flytt markering opp/ned, og vis rundownen i SIB. Markeringen følger SIB live. | `rundown-with-items/`, `rundown/selection`, `rundown/item-run`, `selected-run`, `item-previous-run`, `item-next-run`, `select-previous`, `select-next`, `select-rundown` |
| **Spillelister** | Start fra begynnelsen, fortsett fra sist, eller start fra en bestemt fil. | `playlist/{id}`, `playlist/trig/from_start`, `from_last`, `from_item` |
| **Streaming** | Se alle strømmer og start/stopp dem. | `streams/`, `stream-control/{id}/START\|STOP` |
| **Innstillinger** | SIB-adresse, API-passord, spilleliste-ID-er, og et felt for egendefinerte API-kall (for ishockey, lag, opptak osv.). | |

Tilkoblingsstatusen oppe til høyre viser om SIB svarer.

## Krav

- [Node.js](https://nodejs.org) 18 eller nyere på PC-en som skal kjøre serveren
  (helst samme PC som Sport In The Box).
- REST-API-et må være skrudd på i Sport In The Box.

## Starte

**Windows:** dobbeltklikk `start-sib-kontroll.bat`.

**Kommandolinje:**

```bash
cd sib-kontroll
node server.js
```

(eller `npm start` i `sib-kontroll/`.)

Serveren skriver ut adressene den kan nås på, f.eks.

```
SIB Kontroll kjører — styrer http://localhost:8080
  På denne PC-en:   http://localhost:3000
  Nettbrett/mobil:  http://192.168.1.50:3000
```

Åpne adressen under «Nettbrett/mobil» i Safari/Chrome på nettbrettet. På iPad:
**Del → Legg til på Hjem-skjerm** gir appen et eget ikon og fullskjerm.

Første gang Windows spør om brannmur-tilgang for Node.js: tillat på
**private nettverk**, ellers kommer ikke nettbrettet til.

## Oppsett

Alt stilles inn under **Innstillinger** i appen og lagres i `config.json` ved
siden av `server.js`:

- **Adresse til SIB-API** — `http://localhost:8080` når serveren kjører på
  SIB-PC-en, ellers f.eks. `http://192.168.1.60:8080`.
- **API-passord** — hvis SIB-API-et er passordbeskyttet. Det legges
  automatisk til som siste del av adressen, slik SIB forventer
  (`.../api/quickbutton/trig/8/passord`).
- **Spillelister** — SIB-API-et har ikke noe kall for å liste spillelister,
  så legg inn ID-ene (`medialistOid`) du vil styre.

Alternativt via miljøvariabler: `PORT`, `SIB_URL`, `SIB_PASSWORD`, `SIB_CONFIG`.

> Alle på samme nettverk som når port 3000 kan styre SIB og endre
> innstillingene. Bruk et lukket produksjonsnett, ikke åpent publikums-wifi.

## Teste uten Sport In The Box

`mock-sib.js` etterligner SIB-API-et med eksempeldata fra dokumentasjonen:

```bash
node mock-sib.js          # i ett vindu (port 8080)
node server.js            # i et annet
```

Legg inn spilleliste-ID `1` og `5` under Innstillinger for å teste den fanen.
