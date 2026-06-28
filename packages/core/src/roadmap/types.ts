/**
 * A deterministic "learning roadmap" derived from a repo's detected tech stack
 * and graph shape. Answers: "what would I need to learn to build something like
 * this?" — no network, no LLM, fully reproducible from the scan.
 */

export type SkillLevel = "core" | "recommended" | "advanced";

export interface RoadmapSkill {
  /** Short skill name, e.g. "React" or "Breaking circular dependencies". */
  name: string;
  /** One line on why this matters *for this specific repo*. */
  why: string;
  /** Canonical documentation / learning URL, when one exists. */
  doc?: string;
  /** Rough priority within a stage. */
  level: SkillLevel;
}

export interface RoadmapStage {
  /** Stable id, e.g. "foundations". */
  id: string;
  /** Display title, e.g. "Foundations". */
  title: string;
  /** One-line description of the stage. */
  subtitle: string;
  skills: RoadmapSkill[];
}

export interface Roadmap {
  /** Repo display name the roadmap was built for. */
  repoName: string;
  /** One-line human summary of the whole path. */
  summary: string;
  /** Ordered stages, foundations → ship. Empty stages are omitted. */
  stages: RoadmapStage[];
  /** Total skill count across all stages (for progress meters). */
  skillCount: number;
}
