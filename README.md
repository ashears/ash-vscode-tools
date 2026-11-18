# Ash VS Code Tools

Read PDFs in VS Code while you work. Search the document, jump to a page, or copy a passage with its filename and page number.

[Install from the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=AshtonShears.ash-vscode-tools) · [Download the VSIX](https://github.com/ashears/ash-vscode-tools/releases/latest)

![PDF open in the Ash Tools reader](media/demo.png)

## Open a PDF

Run **Ash Tools: Open PDF** from the Command Palette. If the file is already open in another editor, choose **Reopen Editor With → Ash Tools PDF Reader**.

Use **Copy selection + citation** to paste a passage and its page number into chat. Use **Export Markdown…** if you want the text from several pages in a file.

## Ask Copilot about a PDF

In a trusted local workspace, enable the Ash PDF tools in Copilot Chat’s Agent mode. Give Copilot the PDF’s absolute `file:` URI. For a PDF outside the workspace, open it in Ash Tools first.

> Use #ashPdfSearch to find “retry limit” in file:///path/to/spec.pdf. Read the matching pages with #ashPdfReadPages and cite the page numbers.

The viewer works without Copilot. PDF rendering and text extraction run locally. When you use a PDF tool in Copilot, the returned text enters the chat and may be sent to its model provider.

Requires desktop VS Code 1.137 or later and a local PDF. Scans open in the reader. Search and extraction require a text layer. Use an unprotected copy for password-protected PDFs.

[Source code](https://github.com/ashears/ash-vscode-tools) · [Development and contributing](CONTRIBUTING.md) · [Report an issue](https://github.com/ashears/ash-vscode-tools/issues)
