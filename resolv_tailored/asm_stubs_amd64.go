// +build !noasm

package resolv

// functions from the gonum package that optimizes arithmetic
// operations on lists of float64 values
func axpyUnitaryTo(dst []float64, alpha float64, x, y []float64)
func scalUnitaryTo(dst []float64, alpha float64, x []float64)
