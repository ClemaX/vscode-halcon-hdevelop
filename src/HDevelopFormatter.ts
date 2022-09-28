import exp = require('constants');
import * as vscode from 'vscode';

export class HDevelopFormatter implements vscode.DocumentFormattingEditProvider {
    private static readonly controlExpression = new RegExp('^(\s*)(if|else|endif|while|for|try|catch|endtry)');
    private static readonly controlTerminators: Map<string, string[]> = new Map([["if", ['endif', 'else']], ["else", ['endif']], ["try", ['catch', 'endtry']], ["catch", ['endtry']]]);
    private static readonly indentedContentExpression = new RegExp('^(\s*).');

    formatRawLines(lines: string[]) {
        const editorConfiguration = vscode.workspace.getConfiguration('editor');
        const tabSize = editorConfiguration.get('tabSize') as number;
        const insertSpaces = editorConfiguration.get('insertSpaces') as boolean;
        const indentationText = insertSpaces ? ' '.repeat(tabSize) : '\t';
        const openedControlScopes: string[] = [];

        var expectedIndentation: string = '';

        for (var i = 0, line = lines[0]; i < lines.length; line = lines[++i]) {
            var groups = line.match(HDevelopFormatter.controlExpression);

            if (groups !== null) {
                const [match, space, controlKeyword] = groups;

                var isTerminator = false;
                var isFinalTerminator = false;


                if (openedControlScopes.length !== 0) {
                    const lastControlKeyword = openedControlScopes.at(-1);
                    const terminatorKeywords = HDevelopFormatter.controlTerminators.get(lastControlKeyword!);
                    
                    isTerminator = terminatorKeywords !== undefined && terminatorKeywords.includes(controlKeyword);
                    if (isTerminator) {
                        isFinalTerminator = !HDevelopFormatter.controlTerminators.get(controlKeyword)?.length;
                        openedControlScopes.pop();
                        expectedIndentation = expectedIndentation.slice(0, expectedIndentation.length - indentationText.length);
                    }
                }

                if (space !== expectedIndentation) {
                    lines[i] = expectedIndentation + line.substring(space.length);
                }

                if (!isFinalTerminator) {
                    openedControlScopes.push(controlKeyword);
                    expectedIndentation += indentationText;
                }
            } else {
                groups = line.match(HDevelopFormatter.indentedContentExpression);

                if (groups !== null) {
                    const [match, space] = groups;

                    if (space !== expectedIndentation) {
                        lines[i] = expectedIndentation + line.substring(space.length);
                    }
                }
            }
        }

        return lines;
    }

    formatRawText(text: string): string {
        return this.formatRawLines(text.split('\n')).join('\n');
    }

    provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.TextEdit[] {
        const indentationText = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
        const edits: vscode.TextEdit[] = [];
        const openedControlScopes: string[] = [];

        var expectedIndentation: string = '';

        for (var i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            var groups = line.text.match(HDevelopFormatter.controlExpression);

            if (groups !== null) {
                const [match, space, controlKeyword] = groups;

                var isTerminator = false;
                var isFinalTerminator = false;


                if (openedControlScopes.length !== 0) {
                    const lastControlKeyword = openedControlScopes.at(-1);
                    const terminatorKeywords = HDevelopFormatter.controlTerminators.get(lastControlKeyword!);
                    
                    isTerminator = terminatorKeywords !== undefined && terminatorKeywords.includes(controlKeyword);
                    if (isTerminator) {
                        isFinalTerminator = !HDevelopFormatter.controlTerminators.get(controlKeyword)?.length;
                        openedControlScopes.pop();
                        expectedIndentation = expectedIndentation.slice(0, expectedIndentation.length - indentationText.length);
                    }
                }

                if (space !== expectedIndentation) {
                    const indentationEnd = line.range.start.translate(space.length);

                    edits.push({ range: line.range.with(undefined, indentationEnd), newText: expectedIndentation });
                }

                if (!isFinalTerminator) {
                    openedControlScopes.push(controlKeyword);
                    expectedIndentation += indentationText;
                }
            } else {
                groups = line.text.match(HDevelopFormatter.indentedContentExpression);

                if (groups !== null) {
                    const [match, space] = groups;

                    if (space !== expectedIndentation) {
                        const indentationEnd = line.range.start.translate(space.length);

                        edits.push({ range: line.range.with(undefined, indentationEnd), newText: expectedIndentation });
                    }
                }
            }
        }

        return edits;
    }
}