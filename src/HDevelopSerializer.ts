import * as vscode from "vscode";
import { TextDecoder, TextEncoder } from "util";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { HDevelopFormatter } from "./HDevelopFormatter";

interface RawNotebookCell {
  language: string;
  value: string;
  kind: vscode.NotebookCellKind;
}

interface ProcedureParameter {
  ':@': {'@_base_type': string, '@_dimension': number; '@_name': string};
  par: [];
}

type ProcedureAPI = [{io: ProcedureParameter[]}, {oo: ProcedureParameter[]}, {ic: ProcedureParameter[]}, {oc: ProcedureParameter[]}];

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

type XMLHeader = {':@': [{'@_version': string}]}

type XMLData = [XMLHeader, {hdevelop: HDevelopData}];

interface HDevelopNotebookMetadata {
  originalContent: XMLData;
}

interface HDevelopNotebookData extends vscode.NotebookData {
  metadata: HDevelopNotebookMetadata;
}

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

  private static parseData(fileContent: Uint8Array): XMLData {
    const decodedContent = HDevelopSerializer.textDecoder.decode(fileContent);
    const data = HDevelopSerializer.parser.parse(decodedContent) as XMLData;

    if (data.length < 2 || data[1].hdevelop === undefined) {
      throw "Invalid file: Could not find hdevelop element!"
    }

    if (data[1].hdevelop[0].procedure === undefined || data[1].hdevelop[0].procedure.length < 3
      || data[1].hdevelop[0].procedure[0].interface === undefined || data[1].hdevelop[0].procedure[1].body === undefined || data[1].hdevelop[0].procedure[2].docu === undefined) {
      throw "Invalid file: Could not find procedure elements!";
    }
  
    return data;
  }

  private deserializeBody(body: ProcedureBody): string {
    return HDevelopSerializer.formatter
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

  private deserializeCodeCell(data: XMLData): vscode.NotebookCellData {
    const procedure = data[1].hdevelop[0].procedure;
    const codeCellData = this.deserializeBody(procedure[1].body);

    console.debug(data[1].hdevelop[0].procedure[0].interface)

    return new vscode.NotebookCellData(vscode.NotebookCellKind.Code, codeCellData, 'hdevelop');
  }

  private static deserializeAPIParameters(parameters: ProcedureParameter[]): string {
    return parameters.map((parameter) => {
      const baseType = parameter[":@"]["@_base_type"];
      const dimension = parameter[":@"]["@_dimension"];
      const name = parameter[":@"]["@_name"];

      const dimensionSuffix = (dimension !== 0) ? `[${dimension}]` : '';

      return `${baseType} ${name}${dimensionSuffix}`;
    }).join('\n');
  }

  private deserializeInputObjectCell(data: XMLData): vscode.NotebookCellData {
    const api = data[1].hdevelop[0].procedure[0].interface;
    const inputObjects = api[0].io;
    const code = HDevelopSerializer.deserializeAPIParameters(inputObjects);

    return new vscode.NotebookCellData(vscode.NotebookCellKind.Code, code, 'hdevelop.api')
  }

  private deserializeOutputObjectCell(data: XMLData): vscode.NotebookCellData {
    const api = data[1].hdevelop[0].procedure[0].interface;
    const outputObjects = api[1].oo;
    const code = HDevelopSerializer.deserializeAPIParameters(outputObjects);

    return new vscode.NotebookCellData(vscode.NotebookCellKind.Code, code, 'hdevelop.api')
  }

  private deserializeInputControlCell(data: XMLData): vscode.NotebookCellData {
    const api = data[1].hdevelop[0].procedure[0].interface;
    const inputControls = api[2].ic;
    const code = HDevelopSerializer.deserializeAPIParameters(inputControls);

    return new vscode.NotebookCellData(vscode.NotebookCellKind.Code, code, 'hdevelop.api')
  }

  private deserializeOutputControlCell(data: XMLData): vscode.NotebookCellData {
    const api = data[1].hdevelop[0].procedure[0].interface;
    const outputControls = api[3].oc;
    const code = HDevelopSerializer.deserializeAPIParameters(outputControls);

    return new vscode.NotebookCellData(vscode.NotebookCellKind.Code, code, 'hdevelop.api')
  }

  async deserializeNotebook(
    content: Uint8Array,
    token: vscode.CancellationToken
  ): Promise<vscode.NotebookData> {
    const hdevelopData = HDevelopSerializer.parseData(content);

    const cells: vscode.NotebookCellData[] = [
      this.deserializeInputObjectCell(hdevelopData),
      this.deserializeOutputObjectCell(hdevelopData),
      this.deserializeInputControlCell(hdevelopData),
      this.deserializeOutputControlCell(hdevelopData),
      this.deserializeCodeCell(hdevelopData),
    ];

    const data = new vscode.NotebookData(cells) as HDevelopNotebookData;

    data.metadata = { originalContent: hdevelopData };

    return data;
  }

  private static serializeCodeCell(cell: vscode.NotebookCellData): ProcedureBody {
    return cell.value.split('\n').map((line) => {
        return line.length === 0 || line.startsWith('*') ? {c: [{'#text': line}]} : {l: [{'#text': line}]};
    });
  }

  serializeNotebook(
    data: HDevelopNotebookData,
    token: vscode.CancellationToken
  ): Uint8Array {
    const originalContent = data.metadata.originalContent;

    const body: ProcedureBody = HDevelopSerializer.serializeCodeCell(data.cells[0])

    originalContent[1].hdevelop[0].procedure[1].body = body;

    const fileContents = HDevelopSerializer.serializer.build(originalContent);

    return HDevelopSerializer.textEncoder.encode(fileContents);
  }
}
