import { describe, expect, it } from "vitest";
import {
  buildIbusPrCommands,
  buildIbusPrPlan,
  resolveIbusWorkflowGuidance,
} from "@/lib/ibus/baseVersionWorkflow";

describe("resolveIbusWorkflowGuidance", () => {
  it("reports done when up to date with a clean tree", () => {
    const guidance = resolveIbusWorkflowGuidance({
      status: "up-to-date",
      activeBaseVersionFromXml: "20260731",
      appCurrentBaseVersion: "20260731",
      localImportedBaseVersions: ["20260731"],
      livePredictionBaseVersion: "20260731",
      todayLondon: "2026-08-13",
    });

    expect(guidance.step).toBe("done");
    expect(guidance.headline).toMatch(/up to date/i);
    expect(guidance.nextCommand).toBeNull();
    expect(guidance.detail).toMatch(/nothing needed/i);
  });

  it("prioritises importing the live API version when that folder is missing", () => {
    const guidance = resolveIbusWorkflowGuidance({
      status: "update-needed",
      activeBaseVersionFromXml: "20260816",
      appCurrentBaseVersion: "20260816",
      localImportedBaseVersions: ["20260816"],
      livePredictionBaseVersion: "20260731",
      todayLondon: "2026-08-13",
    });

    expect(guidance.step).toBe("import-live");
    expect(guidance.nextCommand).toContain("IBUS_BASE_VERSION=20260731");
    expect(guidance.detail).toMatch(/Live arrivals use/i);
  });

  it("treats future-dated XML as optional prep when live is already local", () => {
    const guidance = resolveIbusWorkflowGuidance({
      status: "update-needed",
      activeBaseVersionFromXml: "20260816",
      appCurrentBaseVersion: "20260731",
      localImportedBaseVersions: ["20260731"],
      livePredictionBaseVersion: "20260731",
      todayLondon: "2026-08-13",
    });

    expect(guidance.step).toBe("import");
    expect(guidance.headline).toMatch(/optional prep/i);
    expect(guidance.detail).toMatch(/still in the future/i);
    expect(guidance.nextCommandNote).toMatch(/Only delete/);
  });

  it("reports timing-safe when app matches XML but live still uses an older local version", () => {
    const guidance = resolveIbusWorkflowGuidance({
      status: "up-to-date",
      activeBaseVersionFromXml: "20260816",
      appCurrentBaseVersion: "20260816",
      localImportedBaseVersions: ["20260731", "20260816"],
      livePredictionBaseVersion: "20260731",
      todayLondon: "2026-08-13",
    });

    expect(guidance.step).toBe("done");
    expect(guidance.headline).toMatch(/Timing-safe/i);
    expect(guidance.detail).toMatch(/Keep 20260731/);
  });

  it("points to prepare:ibus-pr --apply when data is current but uncommitted", () => {
    const guidance = resolveIbusWorkflowGuidance({
      status: "up-to-date",
      activeBaseVersionFromXml: "20260731",
      appCurrentBaseVersion: "20260731",
      localImportedBaseVersions: ["20260731"],
      hasUncommittedIbusChanges: true,
    });

    expect(guidance.step).toBe("prepare-pr");
    expect(guidance.nextCommand).toBe("npm run prepare:ibus-pr -- --apply");
  });

  it("points to import when the active version is missing locally", () => {
    const guidance = resolveIbusWorkflowGuidance({
      status: "update-needed",
      activeBaseVersionFromXml: "20260815",
      appCurrentBaseVersion: "20260731",
      localImportedBaseVersions: ["20260731"],
      todayLondon: "2026-08-20",
    });

    expect(guidance.step).toBe("import");
    expect(guidance.nextCommand).toBe("npm run import:ibus:active");
    expect(guidance.detail).toContain("20260815");
  });

  it("points to rebuild when the folder exists but current.json is stale", () => {
    const guidance = resolveIbusWorkflowGuidance({
      status: "update-needed",
      activeBaseVersionFromXml: "20260815",
      appCurrentBaseVersion: "20260731",
      localImportedBaseVersions: ["20260731", "20260815"],
    });

    expect(guidance.step).toBe("rebuild-manifest");
    expect(guidance.nextCommand).toBe("npm run rebuild:ibus-manifest");
  });

  it("handles unknown TfL active version", () => {
    const guidance = resolveIbusWorkflowGuidance({
      status: "unknown",
      activeBaseVersionFromXml: null,
      appCurrentBaseVersion: "20260731",
      localImportedBaseVersions: ["20260731"],
    });

    expect(guidance.step).toBe("unknown");
    expect(guidance.nextCommand).toBe("npm run check:ibus");
  });
});

describe("buildIbusPrPlan", () => {
  it("explains force-add and includes PR metadata", () => {
    const plan = buildIbusPrPlan({
      newBaseVersion: "20260815",
      oldBaseVersions: ["20260731"],
    });

    expect(plan.branchName).toBe("chore/ibus-base-20260815");
    expect(plan.previousBaseVersions).toEqual(["20260731"]);

    const forceAdd = plan.steps.find((step) => step.id === "stage-data");
    expect(forceAdd?.command).toBe("git add -f public/data/ibus/20260815");
    expect(forceAdd?.explanation).toMatch(/gitignored/i);
    expect(forceAdd?.explanation).toMatch(/-f/i);

    const removeOld = plan.steps.find((step) => step.id === "remove-old");
    expect(removeOld?.optional).toBe(true);
    expect(removeOld?.command).toContain("git rm -r public/data/ibus/20260731");
  });

  it("never offers to delete the version live predictions still use", () => {
    const plan = buildIbusPrPlan({
      newBaseVersion: "20260816",
      oldBaseVersions: ["20260731", "20260815"],
      livePredictionBaseVersion: "20260731",
    });

    expect(plan.previousBaseVersions).toEqual(["20260815"]);
    expect(plan.keepBaseVersions).toEqual(["20260731"]);
    expect(plan.steps.find((step) => step.id === "remove-old")?.command).not.toContain(
      "20260731",
    );
    expect(plan.steps.find((step) => step.id === "stage-live")?.command).toBe(
      "git add -f public/data/ibus/20260731",
    );
    expect(plan.commitMessage).toMatch(/keep live 20260731/);
  });
});

describe("buildIbusPrCommands", () => {
  it("includes force-add, commit, and push for the new version", () => {
    const commands = buildIbusPrCommands({
      newBaseVersion: "20260815",
      oldBaseVersions: ["20260731"],
    });

    expect(commands.some((line) => line.includes("git rm -r public/data/ibus/20260731"))).toBe(
      true,
    );
    expect(commands).toContain("git add public/data/ibus/current.json");
    expect(commands).toContain("git add -f public/data/ibus/20260815");
    expect(
      commands.some((line) =>
        line.includes(
          'git commit -m "Update iBus static data to active base version 20260815"',
        ),
      ),
    ).toBe(true);
    expect(commands).toContain("git push -u origin HEAD");
  });
});
