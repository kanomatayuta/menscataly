/**
 * コンプライアンスモジュール エントリポイント
 * 薬機法・景表法・ステマ規制対応
 */

export { ComplianceChecker, defaultChecker } from "./checker";
export { insertPRDisclosure, hasPRDisclosure, PR_TEMPLATES } from "./templates/pr-disclosure";
export { checkPharmaceuticalLawPatterns, checkRequiredElements } from "./rules/pharmaceutical-law";
export { checkRepresentationLawPatterns } from "./rules/representation-law";
export { checkStealthMarketingPatterns, checkPRDisclosure } from "./rules/stealth-marketing";
export { processAffiliateLinks } from "./utils/affiliate-links";
export type {
  Category,
  ViolationType,
  Severity,
  NGEntry,
  DictionaryFile,
  Violation,
  ComplianceResult,
  CheckerOptions,
  PRDisclosureTemplate,
} from "./types";
