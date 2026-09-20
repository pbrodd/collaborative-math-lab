// A successful process alone is insufficient: Lean accepts `sorry` with a warning.
export function auditAxioms(output, theorem) {
  const pattern = new RegExp(`'${theorem}' depends on axioms:\\s*\\[([^\\]]*)\\]`, 'g');
  const matches = [...output.matchAll(pattern)];
  const empty = output.includes(`'${theorem}' does not depend on any axioms`);
  if ((matches.length === 1 ? 1 : 0) + Number(empty) !== 1) throw new Error(`Missing or ambiguous axiom audit for ${theorem}.`);
  const axioms = empty ? [] : matches[0][1].split(',').map(s => s.trim()).filter(Boolean).sort();
  const unexpected = axioms.filter(s => !['propext', 'Classical.choice', 'Quot.sound'].includes(s));
  if (unexpected.length) throw new Error(`Unapproved axioms: ${unexpected.join(', ')}`);
  return axioms;
}
