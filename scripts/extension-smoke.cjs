// Runs inside an actual extension host against the packaged extension.
const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
exports.run = async function () {
  const result = { editor: vscode.env.appName, version: vscode.version, checks: [] };
  try {
    const extension = vscode.extensions.getExtension('pesuto.graphtale');
    assert(extension, 'Packaged extension is available');
    await extension.activate(); result.checks.push('activation');
    const root = process.env.GRAPHTALE_SMOKE_ROOT;
    assert(root, 'An isolated sample root is required');
    const file = path.join(root, 'SKILL.md');
    const original = fs.readFileSync(file, 'utf8');
    await vscode.commands.executeCommand('graphtale.openViewer', vscode.Uri.file(file));
    for (let i = 0; i < 50 && !vscode.window.tabGroups.all.some(g => g.tabs.some(t => t.label.startsWith('Graphtale'))); i++) await new Promise(resolve => setTimeout(resolve, 100));
    result.tabs = vscode.window.tabGroups.all.flatMap(g => g.tabs.map(t => t.label));
    assert(vscode.window.tabGroups.all.some(g => g.tabs.some(t => t.label.startsWith('Graphtale'))), 'Viewer tab opened');
    result.checks.push('open viewer command and real webview tab');
    try {
      fs.writeFileSync(file, original + '\n');
      await vscode.commands.executeCommand('graphtale.refresh'); result.checks.push('refresh command');
      fs.unlinkSync(file);
      await vscode.commands.executeCommand('graphtale.refresh'); result.checks.push('deleted-file refresh command returns');
    } finally { fs.writeFileSync(file, original); }
    await vscode.commands.executeCommand('graphtale.refresh'); result.checks.push('restored-file refresh command');
    assert.equal(fs.readFileSync(file, 'utf8'), original); result.checks.push('source unchanged by viewer');
    result.ok = true;
  } catch (error) { result.ok = false; result.error = String(error); throw error; }
  finally { fs.writeFileSync(process.env.GRAPHTALE_SMOKE_RESULT, JSON.stringify(result, null, 2)); }
};
