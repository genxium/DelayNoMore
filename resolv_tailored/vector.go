package resolv

import "math"

// Vector is the definition of a row vector that contains scalars as
// 64 bit floats
type Vector []float64

// Axis is an integer enum type that describes vector axis
type Axis int

const (
	// the consts below are used to represent vector axis, they are useful
	// to lookup values within the vector.
	X Axis = 0
	Y Axis = 1
	Z Axis = 2
)

func (v Vector) Magnitude2() float64 {
	var result float64 = 0.

	for _, scalar := range v {
		result += scalar * scalar
	}

	return result
}

// Unit returns a direction vector with the length of one.
func (v Vector) Unit() Vector {
	l2 := v.Magnitude2()
	if l2 < 1e-16 {
		return v
	}

	l := math.Sqrt(l2)
	//inv := FastInvSqrt64(l2) // "Fast Inverse Square Root" is arch dependent, it's by far non-trivial to use it in Golang as well as make it feasible in the transpiled JavaScript.

	for i := 0; i < len(v); i++ {
		v[i] = v[i] / l
		//v[i] = v[i] * inv
	}

	return v
}

// X is corresponding to doing a v[0] lookup, if index 0 does not exist yet, a
// 0 will be returned instead
func (v Vector) GetX() float64 {
	if len(v) < 1 {
		return 0.
	}

	return v[X]
}

// Y is corresponding to doing a v[1] lookup, if index 1 does not exist yet, a
// 0 will be returned instead
func (v Vector) GetY() float64 {
	if len(v) < 2 {
		return 0.
	}

	return v[Y]
}

// Z is corresponding to doing a v[2] lookup, if index 2 does not exist yet, a
// 0 will be returned instead
func (v Vector) GetZ() float64 {
	if len(v) < 3 {
		return 0.
	}

	return v[Z]
}
