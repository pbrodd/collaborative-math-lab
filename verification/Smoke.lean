import Mathlib

set_option autoImplicit false
set_option maxHeartbeats 400000

theorem linear_example (x : ℝ) : 3 * (x - 2) = 15 ↔ x = 7 := by
  constructor <;> intro h <;> linarith

theorem absolute_example (x : ℝ) : 3 * |x - 4| + 2 = 11 ↔ x = 1 ∨ x = 7 := by
  simp only [abs_eq_ite]
  split_ifs <;> aesop (add safe (by linarith))

#print axioms linear_example
#print axioms absolute_example
