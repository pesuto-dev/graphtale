# Handoff: herstel P/N-flow op basis van bronevidence

Datum: 2026-09-06. Status: diagnose afgerond; implementatie nog uit te voeren.

## Opdracht en toestemming

De gebruiker ziet losse P/N-stappen op één brede rij waar eerder een flow stond. Hij heeft ingestemd met het uitbreiden van de parser om relaties uit de daadwerkelijke workflowbeschrijving te herkennen, met bronverwijzingen, zonder de oude hardcoded vertakkingen terug te zetten. Deze overdracht is bedoeld voor uitvoering in een nieuwe agentsessie.

## Agent en model

- Gebruik één Codex coding-agent met `gpt-5.6-terra`, reasoning `medium`.
- Dit is een taakgerichte keuze: de oorzaak is bekend, maar parserregels en negatieve tests vragen nog programmeerwerk en afwegingen. Geen parallelle agents of volledige conversatiefork nodig.
- Alleen bij vastlopende ambiguïteit: geef `gpt-5.6-sol` een beperkte vraag met relevante bronfragmenten, diff en falende test. Laat niet de hele diagnose opnieuw doen.
- Lees eerst dit bestand, `AGENTS.md`, `CONTEXT.md` en relevante ADRs. Suggestie: diagnose-skill voor de bestaande reproduceer/test/fix-loop; geen ongerelateerde issue-tracker-setup toevoegen.
- Modelkeuze is advies, geen gemeten token- of kostenbelofte. Onderbouwing: [officiële modelgids](https://learn.chatgpt.com/docs/models), geraadpleegd 2026-09-06; Terra voor dagelijks programmeerwerk, lagere reasoning waar voldoende.

Startopdracht voor de nieuwe sessie:

> Voer docs/flow-parser-handoff.md uit. Gebruik één coding-agent, GPT-5.6 Terra met medium reasoning. Hergebruik de diagnose, implementeer brongebonden relatieherkenning met regressietests, verifieer de preview en rapporteer wijzigingen en beperkingen. Bewaar bestaande lokale wijzigingen.

## Bewezen oorzaak en vindplaatsen

- Regressie geïntroduceerd door commit `94ef311` (Prepare Graphtale for public release), ten opzichte van `0e080a2`.
- Oude `src/parseProcedure.ts`, functie `buildPnGraph`: bouwde verbindingen en een Question/Bug/Change-gate op basis van vaste P/N-identifiers. Alleen als historisch vergelijkingsmateriaal gebruiken.
- Huidige `src/procedureDetection.ts`, `extractPn`: herkent P/N-rijen, maar relaties alleen als afzonderlijke regels zoals `P -> N1` of `N3 -> N4 (Bug)`.
- `N1 resolve scripts/resolve.py -> Bundle` beschrijft uitvoer, geen verbinding met een volgende stap.
- `src/parseProcedure.ts`, `wrapWithSource`: verbindt workflow.md alleen met de eerste stap wanneer die stap een uitgaande verbinding heeft.
- `webview/layout.ts`: Dagre TB plaatst de losstaande stappen op dezelfde y-positie. De brede rij volgt uit ontbrekende relaties.
- Bestaande test `preserves P/N rows as source evidence without inventing a DAG` in `src/parseProcedure.test.ts` verwacht expliciet nul runtime-edges. Die test slaagt; het probleem is dus niet door de huidige tests afgevangen.

Uitgevoerde controle: `npx vitest run src/parseProcedure.test.ts -t 'preserves P/N rows'` slaagt. Een parser/layout-harness op `fixtures/analyse-ticket-pn` gaf 12 stappen, alleen de edge `skill-md -> procedure-source`, alle runtime-stappen op y=62. Dit reproduceert de screenshotstructuur, maar de echte gebruikersskill is nog niet ingelezen. De fixture heeft synthetische labels; claim niet dat de exacte gebruikersflow al is gereproduceerd.

## Uitvoering

1. Inspecteer gericht `src/procedureDetection.ts`, `src/parseProcedure.ts`, `src/parseProcedure.test.ts`, `src/procedureEvidence.test.ts`, `src/corpusProcedure.test.ts` en de P/N- en explicit-routing-fixtures. Lees `docs/adr/0005-procedure-honest-inspiration.md` en `docs/adr/0009-source-evidence-review.md`.
2. Vind de echte workflow via beschikbare workspacecontext. Het absolute pad is nog onbekend. Inspecteer relevante P/N-secties en relaties; gebruik zo nodig een gerichte vraag naar het skillpad. Zoek niet breed door alle persoonlijke bestanden. Zonder echte bron kan een generieke verbetering worden gebouwd, maar niet als volledige oplossing voor de screenshot worden afgemeld.
3. Leg de ondersteunde bronpatronen vast vóór implementatie. Zoek expliciete relaties in P/N-sectieproza: volgorde, genoemde volgende stappen, parallelle groepen met vervolg en conditionele routes. Maak een kleine deterministische grammatica op basis van aangetroffen formuleringen; geen algemene natuurlijke-taalinterpretatie of runtime-LLM toevoegen.
4. Voeg eerst falende regressietests toe via `parseProcedure` op een representatieve, gesanitiseerde fixture. Bewaar de kale P/N-tabel als negatieve test: identifiers, inspringing of artefactpijlen alleen rechtvaardigen geen uitvoeringsrelaties. Verander die verwachting niet uitsluitend om een aantrekkelijke flow te krijgen.
5. Implementeer relatie-extractie met `SourceRange` naar de tekst die de relatie onderbouwt. Hergebruik bestaande endpoint-, deduplicatie- en cycluscontroles. Behoud onzekere relaties als unresolved; geen vertrouwen verhogen omdat er toevallig enige edges zijn. Controleer bron-entry-aansluiting bij meerdere startpunten zonder relaties te verzinnen.
6. Houd de wijziging primair in de parser. Alleen gerichte UI-aanpassing als een resterend probleem dit nodig maakt. Bij bron zonder relaties moet de diagnose duidelijk blijven; een layoutwijziging vervangt geen relatieherkenning.
7. Verifieer parser en preview met de nieuwe fixture en, indien beschikbaar, de echte skill. Rond af met diff, tests, ondersteunde notaties en eventuele resterende onzekerheid.

## Acceptatiecriteria

- Expliciet beschreven volgorde, parallelle routes en condities in de gekozen representatieve workflow komen als juiste edges terug, met correcte bronregels.
- Geen vaste semantiek voor `N2a`, `N3`, `N4`, `N5` enzovoort. Hernoemde identifiers met dezelfde expliciete relaties geven dezelfde topologie.
- Outputnamen achter pijlen, voorbeeldsecties, ontbrekende/ambigue endpoints en niet-onderbouwde branches produceren geen verzonnen edges.
- Bestaande expliciete pijlnotatie blijft werken; beschermingen voor dubbele identifiers en cycli blijven intact.
- Een kale P/N-tabel zonder relatiebewijs blijft partial. Niet alle bestaande fixtures hoeven plots high confidence te worden.
- Preview toont de verwachte vertakkingen/volgorde voor de representatieve bron en bronselectie verwijst naar het onderbouwende fragment.
- De bestaande vaardigheidsbestanden van de gebruiker blijven ongewijzigd; geen flow-editor of schrijffunctie toevoegen.

## Verificatie en werkboom

Gebruik eerst gerichte tests tijdens iteratie; daarna eenmaal `npm run check`, `npm test`, `npm run validate` en `npm run compile`. Herhaal brede checks alleen na relevante wijzigingen of failures.

Preview: geef `PREVIEW_SKILL` expliciet mee. `scripts/generate-preview-data.ts` gebruikt inmiddels standaard `fixtures/release-samples/numbered-review`; de default in AGENTS.md is verouderd. Controleer brongebonden edges en daadwerkelijke canvasplaatsing, niet alleen node-aantallen.

Bij overdracht bestaan gebruikerswijzigingen in `docs/skill-locations.md`, `src/discover.ts`, `src/discover.test.ts`. Bewaar ze; niets resetten of overschrijven. Controleer opnieuw `git status` bij aanvang. Diagnose heeft geen productcode aangepast. Dit handoff-bestand is de enige nieuwe repo-wijziging van deze overdracht.

Omgevingsdetail: `tsx` CLI stuitte in deze sandbox op `EPERM` voor een lokale IPC-pipe; de read-only harness werkte na expliciete sandbox-escalatie. Vitest werkte zonder escalatie. Volg de geldende sandboxregels als dit opnieuw optreedt.
