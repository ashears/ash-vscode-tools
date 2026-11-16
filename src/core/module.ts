import type * as vscode from 'vscode';

/** A utility owns its registrations; the extension owns its lifetime. */
export interface UtilityModule extends vscode.Disposable {
  readonly id: string;
}
