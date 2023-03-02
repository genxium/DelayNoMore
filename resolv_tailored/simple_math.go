package resolv

import "unsafe"

const (
	uvnan      = 0x7FF8000000000001
	uvinf      = 0x7FF0000000000000
	uvneginf   = 0xFFF0000000000000
	uvone      = 0x3FF0000000000000
	mask       = 0x7FF
	shift      = 64 - 11 - 1
	bias       = 1023
	signMask   = 1 << 63
	fracMask   = 1<<shift - 1
	MaxFloat64 = 1.79e+308
	magic32    = 0x5f3759df
	magic64    = 0x5fe6eb50c7b537a9
)

func Max(a, b float64) float64 {
	if a > b {
		return a
	} else {
		return b
	}
}

func Min(a, b float64) float64 {
	if a < b {
		return a
	} else {
		return b
	}
}

func Floor(x float64) float64 {
	if x == 0 || IsInf(x, 0) || IsNaN(x) {
		return x
	}
	if x < 0 {
		d, fract := Modf(-x)
		if fract != 0.0 {
			d = d + 1
		}
		return -d
	}
	d, _ := Modf(x)
	return d
}

func Modf(f float64) (outval float64, frac float64) {
	if f < 1 {
		if f < 0 {
			outval1, frac1 := Modf(-f)
			return -outval1, -frac1
		} else if f == 0 {
			return f, f // Return -0, -0 when f == -0
		}
		return 0, f
	}

	x := Float64bits(f)
	e := ((uint)(x>>shift))&mask - bias

	// Keep the top 12+e bits, the integer part; clear the rest.
	if e < 64-12 {
		x &^= 1<<(64-12-e) - 1
	}
	outval = Float64frombits(x)
	frac = f - outval
	return
}

func Float32bits(f float32) uint32     { return *(*uint32)(unsafe.Pointer(&f)) }
func Float32frombits(b uint32) float32 { return *(*float32)(unsafe.Pointer(&b)) }
func Float64bits(f float64) uint64     { return *(*uint64)(unsafe.Pointer(&f)) }
func Float64frombits(b uint64) float64 { return *(*float64)(unsafe.Pointer(&b)) }

func NaN() float64 { return Float64frombits(uvnan) }

func IsNaN(f float64) (is bool) {
	return f != f
}

func IsInf(f float64, sign int) bool {
	return sign >= 0 && f > MaxFloat64 || sign <= 0 && f < -MaxFloat64
}

// FastInvSqrt reference https://medium.com/@adrien.za/fast-inverse-square-root-in-go-and-javascript-for-fun-6b891e74e5a8
func FastInvSqrt32(n float32) float32 {
	if n < 0 {
		return float32(NaN())
	}
	n2, th := n*0.5, float32(1.5)
	b := Float32bits(n)
	b = magic32 - (b >> 1)
	f := Float32frombits(b)
	f *= th - (n2 * f * f)
	return f
}

func FastInvSqrt64(n float64) float64 {
	if n < 0 {
		return NaN()
	}
	n2, th := n*0.5, float64(1.5)
	b := Float64bits(n)
	b = magic64 - (b >> 1)
	f := Float64frombits(b)
	f *= th - (n2 * f * f)
	return f
}
