# Preview release checklist

The release workflow runs on a `v*` tag. In parallel it checks that `OVSX_PAT`
is set and that the tag matches `package.json`, and runs the full CI workflow
(lint, type-check, tests, fixture validation and compile on Ubuntu and Windows
for Node 22 and 24). Only when both pass does the publish job publish the VSIX
that CI built: to Open VSX, to the Visual Studio Marketplace via Entra ID
(OIDC), and to the GitHub Release. A Marketplace error does not block Open VSX
or the GitHub Release. The publish job installs the locked `ovsx` and `vsce`
with `npm ci --ignore-scripts`; nothing is fetched with `npx` at publish time.
`npm run package` does not publish.

For a dry run, start **Release** by hand (Actions, **Run workflow**). It checks
`OVSX_PAT`, runs CI, and runs the publish job up to the point of publishing: it
downloads the tested VSIX, installs the locked tools and prints their versions.
It skips the tag check, the Azure login, and the three publish steps, so it does
not prove the tokens or Entra ID login are valid. Do this before the first tag
after a workflow change: an Open VSX version cannot be published twice.

Before a release, run the checks in the contributor guide, inspect the VSIX
contents, and complete [the smoke test](smoke-test.md) in a clean profile. Use
the publisher and package identity declared in `package.json` (`pesuto` /
`graphtale`) and verify any destination account before publishing.

Record tested Cursor and VS Code versions, operating systems, known parser
limitations, and the exact VSIX attached to the release. Keep screenshots
current and readable; do not use private paths or claim extension-host checks
that were not run.

## Marketplace-publicatie via Entra ID (OIDC)

De Marketplace-stap gebruikt `azure/login` en `vsce publish --azure-credential`
(OIDC), niet meer `VSCE_PAT` in het publish-commando. Zet dit zelf in Azure en
GitHub op voordat je een `v*`-tag pusht:

1. **App-registratie.** Maak in Azure/Entra ID een app-registratie (en de
   bijbehorende service principal).
2. **Federated credential.** Voeg een federated credential toe voor GitHub-repo
   `pesuto-dev/graphtale`, entity type *tag*. De workflow start alleen op tags
   `v*`, dus het subject moet daarbij passen, bijvoorbeeld
   `repo:pesuto-dev/graphtale:ref:refs/tags/v*`. Een klassieke federated
   credential eist vaak een exact subject (één credential per tag). Gebruik
   anders een flexible federated credential met dat patroon, of
   `repo:pesuto-dev/graphtale:ref:refs/tags/*`.
3. **Publisher-rechten.** Voeg de app (de service principal) als lid of
   Contributor toe aan Marketplace-publisher `pesuto` via de Members-pagina
   van de publisher.
4. **GitHub-secrets.** Zet de repository-secrets `AZURE_CLIENT_ID` en
   `AZURE_TENANT_ID`. Een subscription-id is niet nodig
   (`allow-no-subscriptions`).
5. **`VSCE_PAT`.** Laat `VSCE_PAT` staan tot de eerste geslaagde Entra
   ID-release. Verwijder die secret daarna apart; deze wijziging doet dat niet.
