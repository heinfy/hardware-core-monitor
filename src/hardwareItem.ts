import * as vscode from "vscode";

export class HardwareItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly id: string,
    public readonly data?: any,
  ) {
    super(label, collapsibleState);
    this.id = id;
    this.tooltip = `${this.label}`;
    this.description = this.getDescription();
  }

  private getDescription(): string {
    if (this.data) {
      switch (this.id) {
        case "cpu":
          return `Usage: ${this.data.currentLoad?.toFixed(1)}%`;
        case "memory":
          const usage = ((this.data.used / this.data.total) * 100).toFixed(1);
          return `Usage: ${usage}%`;
        default:
          return "";
      }
    }
    return "";
  }

  iconPath = this.getIcon();

  private getIcon(): vscode.ThemeIcon | undefined {
    switch (this.id) {
      case "cpu":
        return new vscode.ThemeIcon("circuit-board");
      case "memory":
        return new vscode.ThemeIcon("server");
      case "disk":
        return new vscode.ThemeIcon("database");
      case "network":
        return new vscode.ThemeIcon("globe");
      case "temperature":
        return new vscode.ThemeIcon("flame");
      case "system":
        return new vscode.ThemeIcon("device-desktop");
      case "battery":
        return new vscode.ThemeIcon("plug");
      default:
        return undefined;
    }
  }
}
