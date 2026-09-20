import bundled from '../verification/receipts.json';
import { LEAN_VERSION, MATHLIB_REVISION, PROOF_FORMAT, type ProofClaim } from './formal';
export type ProofReceipt = { id: string; digest: string; statement: string; axioms: string[] };
export type ProofReport = { format: number; lean: string; mathlib: string; claims: ProofReceipt[] };
export function findReceipt(claim: ProofClaim, digest: string, report: ProofReport = bundled): ProofReceipt | undefined {
  if (report.format !== PROOF_FORMAT || report.lean !== LEAN_VERSION || report.mathlib !== MATHLIB_REVISION) return undefined;
  return report.claims.find(r => r.digest === digest && r.statement === claim.statement && Array.isArray(r.axioms) && r.axioms.every(a => ['propext', 'Classical.choice', 'Quot.sound'].includes(a)));
}
