//go:build !amd64 || noasm
// +build !amd64 noasm

package resolv

// This function is from the gonum repository:
// https://github.com/gonum/gonum/blob/c3867503e73e5c3fee7ab93e3c2c562eb2be8178/internal/asm/f64/axpy.go#L23
func axpyUnitaryTo(dst []float64, alpha float64, x, y []float64) {
	dim := len(y)
	for i, v := range x {
		if i == dim {
			return
		}
		dst[i] = alpha*v + y[i]
	}
}

// This function is from the gonum repository:
// https://github.com/gonum/gonum/blob/c3867503e73e5c3fee7ab93e3c2c562eb2be8178/internal/asm/f64/scal.go#L23
func scalUnitaryTo(dst []float64, alpha float64, x []float64) {
	for i := range x {
		dst[i] *= alpha
	}
}
