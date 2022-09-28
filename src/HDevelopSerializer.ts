import * as vscode from "vscode";
import { TextDecoder, TextEncoder } from "util";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { HDevelopFormatter } from "./HDevelopFormatter";

interface RawNotebookCell {
  language: string;
  value: string;
  kind: vscode.NotebookCellKind;
}

interface ProcedureParameter {}

interface ProcedureAPI {}

type TextNode = [{ "#text"?: string }];

interface CommentNode {
  c: TextNode;
}

interface StatementNode {
  l: TextNode;
}

type ProcedureBody = (StatementNode | CommentNode)[];

interface ProcedureDocu {}

type Procedure = [
  { interface: ProcedureAPI },
  { body: ProcedureBody },
  { docu: ProcedureDocu }
];

type HDevelopData = [{ procedure: Procedure }];

type XMLData = [any, {hdevelop?: HDevelopData}?];

export class HDevelopSerializer implements vscode.NotebookSerializer {
  private static readonly parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    parseAttributeValue: true,
  });
  private static readonly serializer = new XMLBuilder({
    preserveOrder: true,
    ignoreAttributes: false,
    suppressEmptyNode: true,
  });
  private static readonly textDecoder = new TextDecoder();
  private static readonly textEncoder = new TextEncoder();
  private static readonly formatter = new HDevelopFormatter();

  async deserializeNotebook(
    content: Uint8Array,
    token: vscode.CancellationToken
  ): Promise<vscode.NotebookData> {
    const contents = HDevelopSerializer.textDecoder.decode(content);
    const parsedContent = HDevelopSerializer.parser.parse(
      contents
    ) as XMLData;

    var codeCellData: string = "";

    if (parsedContent.length >= 2 && parsedContent[1]!.hdevelop !== undefined) {
      const hdevelop = parsedContent[1]!.hdevelop;

      if (hdevelop !== undefined) {
        const procedure = hdevelop[0].procedure;

        const body = procedure[1].body;
        codeCellData = HDevelopSerializer.formatter
          .formatRawLines(
            body.map(
              (node) =>
                ("l" in node
                  ? node.l.length === 1
                    ? node.l[0]["#text"]
                    : undefined
                  : node.c.length === 1
                  ? node.c[0]["#text"]
                  : undefined) || ""
            )
          )
          .join("\n");
      }
    }

    var rawCells: RawNotebookCell[] = [
      {
        kind: vscode.NotebookCellKind.Code,
        language: "hdevelop",
        value: codeCellData,
      },
    ];

    const cells = rawCells.map(
      (item) =>
        new vscode.NotebookCellData(item.kind, item.value, item.language)
    );

    const data = new vscode.NotebookData(cells);

    data.metadata = { originalContent: parsedContent };

    return data;
  }

  serializeNotebook(
    data: vscode.NotebookData,
    token: vscode.CancellationToken
  ): Uint8Array {
    const originalContent = data.metadata!.originalContent as XMLData;

    const body: ProcedureBody = data.cells[0].value.split('\n').map((line) => {
        return line.length === 0 || line.startsWith('*') ? {c: [{'#text': line}]} : {l: [{'#text': line}]};
    });

    originalContent[0][':@']['@_version'] = '1.0'
    originalContent[1]!.hdevelop![0].procedure[1].body = body;

    const fileContents = HDevelopSerializer.serializer.build(originalContent);

    return HDevelopSerializer.textEncoder.encode(fileContents);
  }
}
